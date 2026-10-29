import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { readSsoConfig, revokeSessionToken, signSessionToken } from './sso.js';
import { createApiAuthMiddleware, createTokenCache } from './auth.js';

const ssoEnv = {
  SSO_BASE_URL: 'https://sso.test',
  SSO_CLIENT_ID: 'app_test',
  SSO_CLIENT_SECRET: 'test-secret',
  SSO_REDIRECT_URI: 'http://127.0.0.1:9999/api/auth/sso/callback'
};

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
};

const createProtectedApp = (options = {}) => {
  const app = express();
  app.use('/api', createApiAuthMiddleware(options));
  app.get('/api/protected', (req, res) => res.json({ user: req.authUser }));
  app.get('/api/ai/image-proxy', (_req, res) => res.json({ proxy: true }));
  return app;
};

test('verified token cache expires entries and enforces a hard cap', () => {
  let timestamp = 1_000;
  const cache = createTokenCache({ maxEntries: 2, ttlMs: 100, now: () => timestamp });

  cache.set('a', { id: 'a' });
  cache.set('b', { id: 'b' });
  assert.equal(cache.size(), 2);
  assert.deepEqual(cache.get('a'), { id: 'a' });

  cache.set('c', { id: 'c' });
  assert.equal(cache.size(), 2);
  assert.equal(cache.get('a'), null);
  assert.deepEqual(cache.get('c'), { id: 'c' });

  cache.set('c', { id: 'c-updated' });
  assert.equal(cache.size(), 2);
  assert.deepEqual(cache.get('c'), { id: 'c-updated' });

  timestamp += 101;
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('c'), null);
});

test('API auth rejects missing and invalid bearer tokens', async () => {
  const server = await startServer(createProtectedApp({ env: ssoEnv }));
  try {
    const missing = await fetch(`${server.origin}/api/protected`);
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get('www-authenticate'), /Bearer/);

    const invalid = await fetch(`${server.origin}/api/protected`, {
      headers: { Authorization: 'Bearer not-a-token' }
    });
    assert.equal(invalid.status, 401);
  } finally {
    await server.close();
  }
});

test('API auth accepts a valid KeyVideo SSO session', async () => {
  const config = readSsoConfig(ssoEnv);
  const session = signSessionToken(
    { id: 'u_sso_auth', email: 'auth@example.com', provider: 'dingtalk' },
    { secret: config.sessionSecret, ttlSeconds: 3600 }
  );
  const server = await startServer(createProtectedApp({ env: ssoEnv }));
  try {
    const response = await fetch(`${server.origin}/api/protected`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.id, 'u_sso_auth');
    assert.equal(body.user.provider, 'dingtalk');
  } finally {
    await server.close();
  }
});

test('API auth verifies a Supabase access token when configured', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ id: 'u_supabase', email: 'sb@example.com' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const server = await startServer(createProtectedApp({
    env: {
      ...ssoEnv,
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_ANON_KEY: 'anon-key'
    },
    fetchImpl
  }));
  try {
    const response = await fetch(`${server.origin}/api/protected`, {
      headers: { Authorization: 'Bearer supabase-access-token' }
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.id, 'u_supabase');
    assert.equal(body.user.provider, 'supabase');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://supabase.test/auth/v1/user');
  } finally {
    await server.close();
  }
});

test('API auth rejects a session revoked by logout', async () => {
  const config = readSsoConfig(ssoEnv);
  const session = signSessionToken(
    { id: 'u_revoked', email: 'revoked@example.com', provider: 'dingtalk' },
    { secret: config.sessionSecret, ttlSeconds: 3600 }
  );
  revokeSessionToken(session.token, { secret: config.sessionSecret });
  const server = await startServer(createProtectedApp({ env: ssoEnv }));
  try {
    const rejected = await fetch(`${server.origin}/api/protected`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    assert.equal(rejected.status, 401);
  } finally {
    await server.close();
  }
});

test('the public image proxy route remains accessible for img tags', async () => {
  const server = await startServer(createProtectedApp({ env: ssoEnv }));
  try {
    const response = await fetch(`${server.origin}/api/ai/image-proxy`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { proxy: true });
  } finally {
    await server.close();
  }
});
