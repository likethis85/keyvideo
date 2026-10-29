import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * File-backed one-time expiring store.
 *
 * Used for SSO `state` and `ticket` values so a callback can be handled by a
 * different process (or survive a restart) when instances share the data volume.
 * Consumption renames the file first, which is atomic on a shared filesystem, so
 * only one consumer can win.
 */
export function createFileExpiringStore(ttlMs, now, {
  directory,
  maxEntries = 5_000
} = {}) {
  if (!directory) throw new Error('directory is required');
  const dir = path.resolve(directory);
  const capacity = Math.max(1, Number(maxEntries) || 5_000);
  const ttl = Math.max(1, Number(ttlMs) || 60_000);

  const ensureDir = () => {
    fs.mkdirSync(dir, { recursive: true });
  };

  const cleanup = () => {
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      return;
    }
    const current = now();
    const alive = [];
    for (const file of files) {
      if (file.endsWith('.tmp') || file.includes('.consume-')) {
        // Leftover temp/claim files are stale by definition.
        try { fs.unlinkSync(path.join(dir, file)); } catch {}
        continue;
      }
      const fullPath = path.join(dir, file);
      let expired = false;
      try {
        const value = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        expired = !value || typeof value.expiresAt !== 'number' || value.expiresAt <= current;
      } catch {
        expired = true;
      }
      if (expired) {
        try { fs.unlinkSync(fullPath); } catch {}
      } else {
        alive.push(fullPath);
      }
    }

    if (alive.length > capacity) {
      alive
        .map(filePath => ({ filePath, mtime: fs.statSync(filePath).mtimeMs }))
        .sort((a, b) => a.mtime - b.mtime)
        .slice(0, alive.length - capacity)
        .forEach(entry => {
          try { fs.unlinkSync(entry.filePath); } catch {}
        });
    }
  };

  return {
    put(value) {
      ensureDir();
      cleanup();
      const key = crypto.randomBytes(24).toString('base64url');
      const target = path.join(dir, `${key}.json`);
      const temp = `${target}.tmp.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
      fs.writeFileSync(temp, JSON.stringify({ ...value, expiresAt: now() + ttl }), { mode: 0o600 });
      fs.renameSync(temp, target);
      return key;
    },
    consume(key) {
      if (typeof key !== 'string' || !key || !/^[A-Za-z0-9_-]+$/.test(key)) return null;
      ensureDir();
      const target = path.join(dir, `${key}.json`);
      const claim = `${target}.consume-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
      try {
        fs.renameSync(target, claim);
      } catch {
        return null;
      }
      try {
        const value = JSON.parse(fs.readFileSync(claim, 'utf-8'));
        if (!value || typeof value.expiresAt !== 'number' || value.expiresAt <= now()) return null;
        return value;
      } catch {
        return null;
      } finally {
        try { fs.unlinkSync(claim); } catch {}
      }
    }
  };
}
