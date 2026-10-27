import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createSsoRouter, readSsoConfig, signSessionToken, verifySessionToken } from './sso.js';

const makeConfigEnv = (overrides = {}) => ({
  SSO_BASE_URL: 'https://sso.test',
  SSO_CLIENT_ID: 'app_test_client',
  SSO_CLIENT_SECRET: 'test-secret',
  SSO_REDIRECT_URI: 'http://127.0.0.1:9999/api/auth/sso/callback',
  SSO_POST_LOGIN_REDIRECT: 'http://localhost:5173/',
  ...overrides
});

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
};

test('session JWTs verify and reject tampering', () => {
  const now = Date.UTC(2026, 9, 27, 9, 0, 0);
  const session = signSessionToken(
    { id: 'u_123', email: 'a@example.com', displayName: 'Alice', provider: 'dingtalk' },
    { secret: 'signing-secret', ttlSeconds: 3600, now: () => now }
  );
  const claims = verifySessionToken(session.token, { secret: 'signing-secret', now: () => now + 1000 });
  assert.equal(claims.sub, 'u_123');
  assert.equal(claims.email, 'a@example.com');
  assert.equal(claims.aud, 'keyvideo');

  const [header, body, signature] = session.token.split('.');
  assert.equal(verifySessionToken(`${header}.${body}.${signature.slice(0, -1)}x`, {
    secret: 'signing-secret',
    now: () => now
  }), null);
  assert.equal(verifySessionToken(session.token, {
    secret: 'different-secret',
    now: () => now
  }), null);
  assert.equal(verifySessionToken(session.token, {
    secret: 'signing-secret',
    now: () => now + 3_601_000
  }), null);
});

test('config is disabled until the client credentials are supplied', () => {
  assert.equal(readSsoConfig({}).configured, false);
  assert.equal(readSsoConfig(makeConfigEnv()).configured, true);
  assert.equal(readSsoConfig(makeConfigEnv({ SSO_CLIENT_SECRET: '' })).configured, false);
});

test('full SSO start -> callback -> ticket exchange -> session flow', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({
      access_token: 'sso-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        id: 'u_sso_1',
        provider: 'dingtalk',
        external_id: 'union-1',
        email: 'employee@example.com',
        display_name: '测试员工',
        avatar_url: null
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth/sso', createSsoRouter({ env: makeConfigEnv(), fetchImpl }));
  const server = await startServer(app);

  try {
    const status = await fetch(`${server.origin}/api/auth/sso/status`).then((response) => response.json());
    assert.deepEqual(status, { configured: true, provider: 'marius-sso', baseUrl: 'https://sso.test' });

    const startResponse = await fetch(
      `${server.origin}/api/auth/sso/start?return_to=${encodeURIComponent('http://localhost:5173/workspace?tab=ai')}`,
      { redirect: 'manual' }
    );
    assert.equal(startResponse.status, 302);
    const authorizeUrl = new URL(startResponse.headers.get('location'));
    assert.equal(authorizeUrl.origin, 'https://sso.test');
    assert.equal(authorizeUrl.pathname, '/authorize');
    assert.equal(authorizeUrl.searchParams.get('client_id'), 'app_test_client');
    assert.equal(authorizeUrl.searchParams.get('response_mode'), 'code');
    const state = authorizeUrl.searchParams.get('state');
    assert.match(state, /^[A-Za-z0-9_-]{20,}$/);

    const callbackResponse = await fetch(
      `${server.origin}/api/auth/sso/callback?code=one-time-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(callbackResponse.status, 303);
    const returnUrl = new URL(callbackResponse.headers.get('location'));
    assert.equal(returnUrl.origin, 'http://localhost:5173');
    assert.equal(returnUrl.pathname, '/workspace');
    assert.equal(returnUrl.searchParams.get('tab'), 'ai');
    const ticket = returnUrl.searchParams.get('sso_ticket');
    assert.ok(ticket);

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/token$/);
    const tokenPayload = JSON.parse(requests[0].options.body);
    assert.equal(tokenPayload.code, 'one-time-code');
    assert.equal(tokenPayload.client_id, 'app_test_client');
    assert.equal(tokenPayload.client_secret, 'test-secret');

    const exchangeResponse = await fetch(`${server.origin}/api/auth/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    assert.equal(exchangeResponse.status, 200);
    const exchangeBody = await exchangeResponse.json();
    assert.equal(exchangeBody.user.id, 'u_sso_1');
    assert.equal(exchangeBody.user.email, 'employee@example.com');
    assert.equal(exchangeBody.user.displayName, '测试员工');

    const sessionResponse = await fetch(`${server.origin}/api/auth/sso/session`, {
      headers: { Authorization: `Bearer ${exchangeBody.token}` }
    });
    assert.equal(sessionResponse.status, 200);
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionBody.user.id, 'u_sso_1');

    const replay = await fetch(`${server.origin}/api/auth/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    assert.equal(replay.status, 400);

    const replayState = await fetch(
      `${server.origin}/api/auth/sso/callback?code=again&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(replayState.status, 303);
    assert.match(replayState.headers.get('location'), /sso_error=invalid_state/);
  } finally {
    await server.close();
  }
});

test('untrusted return_to values fall back to the configured frontend URL', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/sso', createSsoRouter({
    env: makeConfigEnv(),
    fetchImpl: async () => new Response(JSON.stringify({ user: { id: 'u_2' } }), { status: 200 })
  }));
  const server = await startServer(app);

  try {
    const startResponse = await fetch(
      `${server.origin}/api/auth/sso/start?return_to=${encodeURIComponent('https://evil.example/steal')}`,
      { redirect: 'manual' }
    );
    const state = new URL(startResponse.headers.get('location')).searchParams.get('state');
    const callbackResponse = await fetch(
      `${server.origin}/api/auth/sso/callback?code=code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    const returnUrl = new URL(callbackResponse.headers.get('location'));
    assert.equal(returnUrl.origin, 'http://localhost:5173');
    assert.equal(returnUrl.pathname, '/');
  } finally {
    await server.close();
  }
});

test('SSO endpoints fail clearly when not configured', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/sso', createSsoRouter({ env: {} }));
  const server = await startServer(app);

  try {
    const status = await fetch(`${server.origin}/api/auth/sso/status`).then((response) => response.json());
    assert.equal(status.configured, false);
    const exchange = await fetch(`${server.origin}/api/auth/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'x' })
    });
    assert.equal(exchange.status, 503);
    const start = await fetch(`${server.origin}/api/auth/sso/start`, { redirect: 'manual' });
    assert.equal(start.status, 503);
  } finally {
    await server.close();
  }
});
