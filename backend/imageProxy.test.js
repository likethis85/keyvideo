import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createImageProxyHandler } from './imageProxy.js';

const startServer = async (handler) => {
  const app = express();
  app.get('/api/ai/image-proxy', handler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
};

const proxyUrl = (origin) => `${origin}/api/ai/image-proxy?url=${encodeURIComponent('https://media.sandbase.ai/output.png')}`;

const allowAllImages = async () => {};

test('streams an allowed image response', async () => {
  const fetchImpl = async () => new Response(Uint8Array.from([1, 2, 3, 4]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
  const server = await startServer(createImageProxyHandler({ fetchImpl, validateUrl: allowAllImages }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);
  } finally {
    await server.close();
  }
});

test('rejects redirects that leave the allowed host before fetching them', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/internal.png' }
    });
  };
  const server = await startServer(createImageProxyHandler({ fetchImpl, validateUrl: allowAllImages }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 400);
    assert.equal(requested.length, 1);
    assert.equal(requested[0], 'https://media.sandbase.ai/output.png');
  } finally {
    await server.close();
  }
});

test('validates every allowed-host redirect hop', async () => {
  const validated = [];
  const fetchImpl = async (url) => {
    if (url.endsWith('/output.png')) {
      return new Response(null, { status: 302, headers: { Location: 'https://media.sandbase.ai/final.png' } });
    }
    return new Response(Uint8Array.from([9]), { status: 200, headers: { 'Content-Type': 'image/png' } });
  };
  const validateUrl = async (url) => { validated.push(url.hostname); };
  const server = await startServer(createImageProxyHandler({ fetchImpl, validateUrl }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 200);
    assert.deepEqual(validated, ['media.sandbase.ai', 'media.sandbase.ai']);
  } finally {
    await server.close();
  }
});

test('aborts chunked bodies that exceed the byte limit', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
      controller.close();
    }
  });
  const fetchImpl = async () => new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
  const server = await startServer(createImageProxyHandler({
    fetchImpl,
    validateUrl: allowAllImages,
    maxBytes: 10
  }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 413);
  } finally {
    await server.close();
  }
});

test('times out when the upstream body never finishes', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(4));
    }
  });
  const fetchImpl = async () => new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
  const server = await startServer(createImageProxyHandler({
    fetchImpl,
    validateUrl: allowAllImages,
    timeoutMs: 50
  }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 504);
  } finally {
    await server.close();
  }
});

test('times out when the upstream never sends response headers', async () => {
  const fetchImpl = () => new Promise(() => {});
  const server = await startServer(createImageProxyHandler({
    fetchImpl,
    validateUrl: allowAllImages,
    timeoutMs: 50
  }));
  try {
    const response = await fetch(proxyUrl(server.origin));
    assert.equal(response.status, 504);
  } finally {
    await server.close();
  }
});

test('rejects non-image responses and disallowed initial URLs', async () => {
  const fetchImpl = async () => new Response('nope', {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
  const server = await startServer(createImageProxyHandler({ fetchImpl, validateUrl: allowAllImages }));
  try {
    const notImage = await fetch(proxyUrl(server.origin));
    assert.equal(notImage.status, 502);

    const badHost = await fetch(`${server.origin}/api/ai/image-proxy?url=${encodeURIComponent('https://example.com/a.png')}`);
    assert.equal(badHost.status, 400);

    const badProtocol = await fetch(`${server.origin}/api/ai/image-proxy?url=${encodeURIComponent('http://media.sandbase.ai/a.png')}`);
    assert.equal(badProtocol.status, 400);
  } finally {
    await server.close();
  }
});

test('rate limits by client IP', async () => {
  const fetchImpl = async () => new Response(Uint8Array.from([1]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
  const server = await startServer(createImageProxyHandler({
    fetchImpl,
    validateUrl: allowAllImages,
    rateLimitPerMinute: 2
  }));
  try {
    assert.equal((await fetch(proxyUrl(server.origin))).status, 200);
    assert.equal((await fetch(proxyUrl(server.origin))).status, 200);
    const limited = await fetch(proxyUrl(server.origin));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
  } finally {
    await server.close();
  }
});
