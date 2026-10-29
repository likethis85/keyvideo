import test from 'node:test';
import assert from 'node:assert/strict';
import { compactTaskStore } from './taskHistory.js';

const task = (taskId, userId, createdAt, status = 'completed') => ({
  taskId,
  userId,
  createdAt,
  status
});

test('keeps active tasks even when they are older than the recent window', () => {
  const tasks = {
    running: task('running', 'user-a', 1, 'processing'),
    pending: task('pending', 'user-a', 2, 'pending')
  };
  for (let index = 0; index < 20; index += 1) {
    tasks[`done-${index}`] = task(`done-${index}`, 'user-b', 100 + index);
  }

  const compacted = compactTaskStore(tasks, { perUserLimit: 2, totalLimit: 5 });
  assert.ok(compacted.running);
  assert.ok(compacted.pending);
  const completed = Object.values(compacted).filter(item => item.status === 'completed');
  assert.equal(completed.length, 2);
  assert.deepEqual(completed.map(item => item.taskId).sort(), ['done-18', 'done-19']);
});

test('applies a per-user quota so one account cannot evict others', () => {
  const tasks = {
    a1: task('a1', 'user-a', 1),
    a2: task('a2', 'user-a', 2),
    a3: task('a3', 'user-a', 3),
    b1: task('b1', 'user-b', 4)
  };

  const compacted = compactTaskStore(tasks, { perUserLimit: 2, totalLimit: 10 });
  assert.deepEqual(Object.keys(compacted).sort(), ['a2', 'a3', 'b1']);
});

test('respects the global total and leaves the input untouched', () => {
  const tasks = {};
  for (let index = 0; index < 10; index += 1) {
    tasks[`u${index}`] = task(`u${index}`, `user-${index}`, index);
  }
  const before = JSON.stringify(tasks);

  const compacted = compactTaskStore(tasks, { perUserLimit: 5, totalLimit: 3 });
  assert.equal(Object.keys(compacted).length, 3);
  assert.deepEqual(Object.keys(compacted).sort(), ['u7', 'u8', 'u9']);
  assert.equal(JSON.stringify(tasks), before);
});
