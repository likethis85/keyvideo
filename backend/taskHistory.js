export const DEFAULT_HISTORY_PER_USER = 100;
export const DEFAULT_HISTORY_TOTAL = 500;

const ACTIVE_STATUSES = new Set(['pending', 'processing']);

/**
 * Compacts task history without dropping work that is still running.
 *
 * Active tasks are always retained (up to a safety cap). Completed/failed tasks
 * are kept newest-first with a per-user quota and a global cap, so one account
 * cannot evict another account's running task or monopolize the whole file.
 */
export const compactTaskStore = (tasks, {
  perUserLimit = DEFAULT_HISTORY_PER_USER,
  totalLimit = DEFAULT_HISTORY_TOTAL,
  activeLimit = 1_000
} = {}) => {
  const perUser = Math.max(1, Number(perUserLimit) || DEFAULT_HISTORY_PER_USER);
  const total = Math.max(1, Number(totalLimit) || DEFAULT_HISTORY_TOTAL);
  const activeCap = Math.max(1, Number(activeLimit) || 1_000);

  const entries = Object.values(tasks || {})
    .filter(task => task && typeof task === 'object')
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  const result = {};
  let activeCount = 0;
  for (const task of entries) {
    if (!ACTIVE_STATUSES.has(task.status)) continue;
    if (activeCount >= activeCap) break;
    result[task.taskId] = task;
    activeCount += 1;
  }

  const perUserCount = new Map();
  let kept = 0;
  for (const task of entries) {
    if (kept >= total) break;
    if (result[task.taskId]) continue;
    const owner = task.userId || '__unknown__';
    const used = perUserCount.get(owner) || 0;
    if (used >= perUser) continue;
    result[task.taskId] = task;
    perUserCount.set(owner, used + 1);
    kept += 1;
  }

  return result;
};
