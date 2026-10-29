import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  createIdempotencyMiddleware,
  fingerprintRequestBody,
  IDEMPOTENT_GENERATION_PATHS
} from './idempotency.js';

const startServer = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
};

const createTestApp = ({ capacity = 100, handler } = {}) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const user = req.get('x-user');
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.authUser = { id: user };
    return next();
  });
  const idempotency = createIdempotencyMiddleware({ maxEntries: capacity });
  app.use(IDEMPOTENT_GENERATION_PATHS, idempotency);
  let calls = 0;
  app.post('/api/video/task', async (req, res) => {
    calls += 1;
    const result = await handler(req, res, calls);
    return result;
  });
  return { app, middleware: idempotency, calls: () => calls };
};

const post = (origin, { user = 'user-a', key = 'key-1', body = { prompt: 'p' } } = {}) => fetch(
  `${origin}/api/video/task`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'x-user': user } : {}),
      ...(key ? { 'X-Idempotency-Key': key } : {})
    },
    body: JSON.stringify(body)
  }
);

test('replays a completed response for the same user, route, key and body', async () => {
  const { app, calls } = createTestApp({
    handler: async (_req, res) => res.json({ taskId: 'task-1' })
  });
  const server = await startServer(app);
  try {
    const first = await post(server.origin);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-idempotency-replayed'), null);
    assert.deepEqual(await first.json(), { taskId: 'task-1' });

    const second = await post(server.origin);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-idempotency-replayed'), 'true');
    assert.deepEqual(await second.json(), { taskId: 'task-1' });
    assert.equal(calls(), 1);
  } finally {
    await server.close();
  }
});

test('does not share cached results across accounts or payloads', async () => {
  const { app, calls } = createTestApp({
    handler: async (req, res) => res.json({ prompt: req.body.prompt })
  });
  const server = await startServer(app);
  try {
    await post(server.origin, { user: 'user-a' });
    await post(server.origin, { user: 'user-b' });
    await post(server.origin, { user: 'user-a', body: { prompt: 'different' } });

    assert.equal(calls(), 3);
    const replay = await post(server.origin, { user: 'user-a' });
    assert.equal(replay.headers.get('x-idempotency-replayed'), 'true');
    assert.deepEqual(await replay.json(), { prompt: 'p' });
  } finally {
    await server.close();
  }
});

test('never caches unauthenticated requests', async () => {
  const { app, calls } = createTestApp({
    handler: async (_req, res) => res.json({ ok: true })
  });
  const server = await startServer(app);
  try {
    const first = await post(server.origin, { user: null });
    assert.equal(first.status, 401);
    const second = await post(server.origin, { user: null });
    assert.equal(second.status, 401);
    assert.equal(calls(), 0);
  } finally {
    await server.close();
  }
});

test('coalesces concurrent requests carrying the same key', async () => {
  const { app, calls } = createTestApp({
    handler: async (_req, res) => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return res.json({ taskId: 'slow-task' });
    }
  });
  const server = await startServer(app);
  try {
    const [a, b] = await Promise.all([
      post(server.origin),
      post(server.origin)
    ]);
    assert.deepEqual(await a.json(), { taskId: 'slow-task' });
    assert.deepEqual(await b.json(), { taskId: 'slow-task' });
    assert.equal(calls(), 1);
  } finally {
    await server.close();
  }
});

test('does not replay server errors so a retry can run again', async () => {
  let attempt = 0;
  const { app } = createTestApp({
    handler: async (_req, res) => {
      attempt += 1;
      if (attempt === 1) return res.status(500).json({ error: 'upstream_failed' });
      return res.json({ taskId: 'task-ok' });
    }
  });
  const server = await startServer(app);
  try {
    const first = await post(server.origin);
    assert.equal(first.status, 500);
    const second = await post(server.origin);
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { taskId: 'task-ok' });
  } finally {
    await server.close();
  }
});

test('bounds the cache with hard-cap eviction under high-cardinality keys', async () => {
  const { app, middleware, calls } = createTestApp({
    capacity: 5,
    handler: async (_req, res) => res.json({ ok: true })
  });
  const server = await startServer(app);
  try {
    for (let index = 0; index < 20; index += 1) {
      const response = await post(server.origin, { key: `cardinality-${index}` });
      assert.equal(response.status, 200);
      assert.ok(middleware.store.size <= 5);
    }
    assert.equal(calls(), 20);
  } finally {
    await server.close();
  }
});

test('canonical body fingerprints are stable across key ordering', () => {
  assert.equal(
    fingerprintRequestBody({ b: 2, a: 1 }),
    fingerprintRequestBody({ a: 1, b: 2 })
  );
  assert.notEqual(
    fingerprintRequestBody({ a: 1 }),
    fingerprintRequestBody({ a: 2 })
  );
});
