import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileExpiringStore } from './expiringStore.js';

const makeStore = (ttlMs, clock) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'keyvideo-sso-'));
  const store = createFileExpiringStore(ttlMs, clock, { directory });
  return { store, directory };
};

test('file store consumes a value exactly once', () => {
  const { store, directory } = makeStore(60_000, () => 1_000);
  try {
    const key = store.put({ user: 'a' });
    assert.deepEqual(store.consume(key), { user: 'a', expiresAt: 61_000 });
    assert.equal(store.consume(key), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('file store rejects expired and malformed keys', () => {
  let timestamp = 1_000;
  const { store, directory } = makeStore(100, () => timestamp);
  try {
    const expired = store.put({ user: 'b' });
    timestamp += 101;
    assert.equal(store.consume(expired), null);

    assert.equal(store.consume(''), null);
    assert.equal(store.consume('../etc/passwd'), null);
    assert.equal(store.consume('missing-key'), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('file store drops expired files during cleanup', () => {
  let timestamp = 5_000;
  const { store, directory } = makeStore(50, () => timestamp);
  try {
    store.put({ user: 'c' });
    timestamp += 51;
    const next = store.put({ user: 'd' });
    assert.deepEqual(store.consume(next), { user: 'd', expiresAt: timestamp + 50 });
    const remaining = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
    assert.equal(remaining.length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
