export interface SyncSchedulerOptions<T extends { id: string }> {
  sync: (item: T) => void | Promise<void>;
  fingerprint?: (item: T) => string;
}

/**
 * Schedules project syncs so that:
 *  - each project is synced serially (no overlapping uploads/writes),
 *  - only the newest queued snapshot runs next (older snapshots are dropped),
 *  - unchanged projects are skipped entirely.
 *
 * This prevents an older autosave from finishing last and overwriting a newer
 * cloud state, and avoids re-uploading the same assets on every render.
 */
export function createProjectSyncScheduler<T extends { id: string }>({
  sync,
  fingerprint = (item) => JSON.stringify(item)
}: SyncSchedulerOptions<T>) {
  const running = new Set<string>();
  const pending = new Map<string, { item: T; fingerprint: string }>();
  const lastQueued = new Map<string, string>();
  const lastCompleted = new Map<string, string>();

  const drain = async (id: string) => {
    running.add(id);
    try {
      while (pending.has(id)) {
        const next = pending.get(id);
        pending.delete(id);
        if (!next) break;
        try {
          await sync(next.item);
          lastCompleted.set(id, next.fingerprint);
        } catch {
          // Allow an explicit later schedule to retry the same snapshot.
          lastQueued.delete(id);
        }
      }
    } finally {
      running.delete(id);
    }
  };

  const schedule = (item: T) => {
    const id = item.id;
    const snapshot = fingerprint(item);
    if (lastQueued.get(id) === snapshot) return;
    if (!pending.has(id) && !running.has(id) && lastCompleted.get(id) === snapshot) return;

    lastQueued.set(id, snapshot);
    pending.set(id, { item, fingerprint: snapshot });
    if (!running.has(id)) void drain(id);
  };

  const hasPending = (id: string) => pending.has(id) || running.has(id);

  return { schedule, hasPending };
}
