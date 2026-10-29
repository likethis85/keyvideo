import test from 'node:test';
import assert from 'node:assert/strict';
import { processJsonRpcLine } from './mcpServer.js';

test('parses JSON-RPC and reports parse errors with a null id', async () => {
  assert.equal(await processJsonRpcLine('   '), null);
  const response = await processJsonRpcLine('{not json');
  assert.equal(response.id, null);
  assert.equal(response.error.code, -32700);
});

test('rejects invalid requests while preserving a usable id', async () => {
  const response = await processJsonRpcLine(JSON.stringify({ id: 'req-1', jsonrpc: '2.0' }));
  assert.equal(response.id, 'req-1');
  assert.equal(response.error.code, -32600);

  const arrayResponse = await processJsonRpcLine(JSON.stringify([{ id: 7, method: 'initialize' }]));
  assert.equal(arrayResponse.id, null);
  assert.equal(arrayResponse.error.code, -32600);
});

test('returns method-not-found against the original request id', async () => {
  const response = await processJsonRpcLine(JSON.stringify({ id: 42, method: 'unknown/method' }));
  assert.equal(response.id, 42);
  assert.equal(response.error.code, -32601);
});

test('validates tools/call params and keeps the id on tool failures', async () => {
  const missingName = await processJsonRpcLine(JSON.stringify({
    id: 'call-1',
    method: 'tools/call',
    params: { arguments: {} }
  }));
  assert.equal(missingName.id, 'call-1');
  assert.equal(missingName.error.code, -32602);

  const failed = await processJsonRpcLine(JSON.stringify({
    id: 'call-2',
    method: 'tools/call',
    params: { name: 'not_a_real_tool', arguments: {} }
  }));
  assert.equal(failed.id, 'call-2');
  assert.equal(failed.error.code, -32603);
});

test('handles initialize and stays silent for notifications', async () => {
  const initialized = await processJsonRpcLine(JSON.stringify({
    id: 1,
    method: 'initialize',
    params: {}
  }));
  assert.equal(initialized.id, 1);
  assert.equal(initialized.result.serverInfo.name, 'keyvideo-mcp-server');

  const notification = await processJsonRpcLine(JSON.stringify({
    method: 'initialize',
    params: {}
  }));
  assert.equal(notification, null);
});
