import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createUploadRouter, sanitizeOwnerSegment } from './uploads.js';

process.env.OSS_BUCKET = 'test-bucket';
process.env.OSS_REGION = 'oss-cn-test';

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
};

const createApp = ({ maxUploadBytes } = {}) => {
  const puts = [];
  const deletes = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.get('x-user');
    if (user) req.authUser = { id: user };
    next();
  });
  app.use('/api', createUploadRouter({
    maxUploadBytes,
    randomSuffix: () => 'suffix',
    createOssClient: () => ({
      put: async (key, body, options) => {
        puts.push({ key, body, options });
        return { url: `https://test-bucket.oss-cn-test.aliyuncs.com/${key}` };
      },
      delete: async (key) => { deletes.push(key); }
    }),
    logger: { log: () => {}, error: () => {} }
  }));
  return { app, puts, deletes };
};

const upload = (origin, { user = 'user-a', name = 'voice.mp3', data = 'abc' } = {}) => fetch(
  `${origin}/api/upload?name=${encodeURIComponent(name)}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(user ? { 'x-user': user } : {})
    },
    body: data
  }
);

const remove = (origin, { user = 'user-a', url }) => fetch(`${origin}/api/upload/delete`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(user ? { 'x-user': user } : {})
  },
  body: JSON.stringify({ url })
});

test('uploads are written under the authenticated user prefix', async () => {
  const { app, puts } = createApp();
  const server = await startServer(app);
  try {
    const response = await upload(server.origin, { user: 'user-a' });
    assert.equal(response.status, 200);
    assert.equal(puts.length, 1);
    assert.match(puts[0].key, /^audio\/user-a\/\d+_suffix\.mp3$/);
    assert.equal(puts[0].options.headers['x-oss-meta-keyvideo-owner'], 'user-a');
    assert.equal(
      (await response.json()).url,
      `https://test-bucket.oss-cn-test.aliyuncs.com/${puts[0].key}`
    );
  } finally {
    await server.close();
  }
});

test('deletes only succeed for the caller-owned prefix', async () => {
  const { app, deletes } = createApp();
  const server = await startServer(app);
  try {
    const ownUrl = 'https://test-bucket.oss-cn-test.aliyuncs.com/audio/user-a/1_file.mp3';
    const own = await remove(server.origin, { user: 'user-a', url: ownUrl });
    assert.equal(own.status, 200);
    assert.deepEqual(deletes, ['audio/user-a/1_file.mp3']);

    const crossUser = await remove(server.origin, { user: 'user-b', url: ownUrl });
    assert.equal(crossUser.status, 403);

    const legacy = await remove(server.origin, {
      user: 'user-a',
      url: 'https://test-bucket.oss-cn-test.aliyuncs.com/audio/legacy.mp3'
    });
    assert.equal(legacy.status, 403);

    const traversal = await remove(server.origin, {
      user: 'user-a',
      url: 'https://test-bucket.oss-cn-test.aliyuncs.com/audio/user-a/../user-b/x.mp3'
    });
    assert.equal(traversal.status, 403);

    assert.equal(deletes.length, 1);
  } finally {
    await server.close();
  }
});

test('rejects foreign buckets, missing auth and disallowed types', async () => {
  const { app } = createApp();
  const server = await startServer(app);
  try {
    const foreign = await remove(server.origin, {
      user: 'user-a',
      url: 'https://evil.example.com/audio/user-a/x.mp3'
    });
    assert.equal(foreign.status, 400);

    const unauthenticated = await upload(server.origin, { user: null });
    assert.equal(unauthenticated.status, 401);

    const disallowed = await upload(server.origin, { name: 'payload.exe' });
    assert.equal(disallowed.status, 400);
  } finally {
    await server.close();
  }
});

test('rejects uploads over the byte limit without writing to OSS', async () => {
  const { app, puts } = createApp({ maxUploadBytes: 4 });
  const server = await startServer(app);
  try {
    const response = await upload(server.origin, { data: '0123456789' });
    assert.equal(response.status, 413);
    assert.equal(puts.length, 0);
  } finally {
    await server.close();
  }
});

test('owner segments cannot escape the user prefix', () => {
  assert.equal(sanitizeOwnerSegment('../../evil'), '______evil');
  assert.equal(sanitizeOwnerSegment('user-a'), 'user-a');
  assert.equal(sanitizeOwnerSegment(''), '');
});
