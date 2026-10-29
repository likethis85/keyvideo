import test from 'node:test';
import assert from 'node:assert/strict';
import { readBodyWithTimeout } from './remoteUrl.js';

test('reads JSON bodies normally', async () => {
  const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
  const data = await readBodyWithTimeout(response, { timeoutMs: 1_000, format: 'json' });
  assert.deepEqual(data, { ok: true });
});

test('aborts and cancels a body that never finishes', async () => {
  let cancelled = false;
  const stalled = {
    arrayBuffer: () => new Promise(() => {}),
    body: {
      cancel: async () => { cancelled = true; }
    }
  };

  await assert.rejects(
    readBodyWithTimeout(stalled, { timeoutMs: 10 }),
    /body timed out/
  );
  assert.equal(cancelled, true);
});

test('reads array buffers within the byte limit flow', async () => {
  const buffer = new Uint8Array([1, 2, 3]);
  const response = new Response(buffer);
  const result = await readBodyWithTimeout(response, { timeoutMs: 1_000 });
  assert.equal(result.byteLength, 3);
});
