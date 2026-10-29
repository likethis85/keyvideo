import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpstreamIdempotencyKey, submitSandbaseTask } from './sandbaseSubmit.js';

const quietLogger = { log: () => {}, warn: () => {}, error: () => {} };
const payload = { model: 'test/model', prompt: 'walk', images: ['data:image/png;base64,AAA'] };
const baseOptions = {
  apiKey: 'test-key',
  userId: 'user-a',
  requestKey: 'request-1',
  sleep: async () => {},
  logger: quietLogger
};

test('submits once and forwards a stable upstream idempotency key', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'task-1', status: 'queued' });
  };
  const taskId = await submitSandbaseTask(payload, { ...baseOptions, fetchImpl });

  assert.equal(taskId, 'task-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.sandbase.ai/v1/run');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
  assert.equal(
    calls[0].options.headers['Idempotency-Key'],
    buildUpstreamIdempotencyKey({ userId: 'user-a', requestKey: 'request-1', payload })
  );
});

test('does not retry ambiguous 5xx responses', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('upstream exploded', { status: 503 });
  };
  await assert.rejects(
    submitSandbaseTask(payload, { ...baseOptions, fetchImpl }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.retryable, false);
      assert.ok(error.upstreamIdempotencyKey);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('does not retry network errors or timeouts', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const error = new Error('socket hang up');
    error.retryable = true;
    throw error;
  };
  await assert.rejects(
    submitSandbaseTask(payload, { ...baseOptions, fetchImpl }),
    (error) => {
      assert.equal(error.retryable, true);
      assert.ok(error.upstreamIdempotencyKey);
      return true;
    }
  );
  assert.equal(calls, 1);

  calls = 0;
  const timeoutFetch = async () => {
    calls += 1;
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  await assert.rejects(
    submitSandbaseTask(payload, { ...baseOptions, fetchImpl: timeoutFetch, timeoutMs: 10 }),
    /timed out/
  );
  assert.equal(calls, 1);
});

test('exposes the same upstream key when the provider accepted but the connection dropped', async () => {
  const keys = [];
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    keys.push(options.headers['Idempotency-Key']);
    const error = new Error('socket hang up after request write');
    error.retryable = true;
    throw error;
  };

  await assert.rejects(
    submitSandbaseTask(payload, { ...baseOptions, fetchImpl }),
    (error) => {
      assert.equal(error.retryable, true);
      assert.ok(error.upstreamIdempotencyKey);
      return true;
    }
  );
  assert.equal(calls, 1);

  const acceptedFetch = async (_url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    return Response.json({ id: 'task-after-recovery', status: 'queued' });
  };
  const recoveredId = await submitSandbaseTask(payload, { ...baseOptions, fetchImpl: acceptedFetch });

  assert.equal(recoveredId, 'task-after-recovery');
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test('retries rate limits with the same idempotency key', async () => {
  const keys = [];
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    keys.push(options.headers['Idempotency-Key']);
    if (calls === 1) return new Response('slow down', { status: 429 });
    return Response.json({ id: 'task-after-429', status: 'queued' });
  };
  const taskId = await submitSandbaseTask(payload, { ...baseOptions, fetchImpl });

  assert.equal(taskId, 'task-after-429');
  assert.equal(calls, 2);
  assert.equal(keys[0], keys[1]);
});

test('retries request timeouts rejected by the provider', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response('timeout', { status: 408 });
    return Response.json({ id: 'task-after-408', status: 'queued' });
  };
  assert.equal(await submitSandbaseTask(payload, { ...baseOptions, fetchImpl }), 'task-after-408');
  assert.equal(calls, 2);
});

test('does not retry client errors', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('bad request', { status: 400 });
  };
  await assert.rejects(submitSandbaseTask(payload, { ...baseOptions, fetchImpl }), /400/);
  assert.equal(calls, 1);
});

test('does not retry a success response without a task id', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ status: 'queued' });
  };
  await assert.rejects(
    submitSandbaseTask(payload, { ...baseOptions, fetchImpl }),
    (error) => error.retryable === true
  );
  assert.equal(calls, 1);
});

test('omits the idempotency header when no identity is available', async () => {
  const headers = [];
  const fetchImpl = async (_url, options) => {
    headers.push(options.headers);
    return Response.json({ id: 'task-2', status: 'queued' });
  };
  await submitSandbaseTask(payload, {
    ...baseOptions,
    userId: '',
    requestKey: '',
    fetchImpl
  });
  assert.equal(headers[0]['Idempotency-Key'], undefined);
});

test('upstream keys are isolated by user and payload', () => {
  const requestKey = 'request-1';
  const a = buildUpstreamIdempotencyKey({ userId: 'user-a', requestKey, payload });
  const b = buildUpstreamIdempotencyKey({ userId: 'user-b', requestKey, payload });
  const c = buildUpstreamIdempotencyKey({
    userId: 'user-a',
    requestKey,
    payload: { ...payload, prompt: 'run' }
  });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});
