import type Database from '@tauri-apps/plugin-sql';

// localDB - keyvalue store with SQLite backend in Tauri and IndexedDB fallback in browser

const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

let sqliteDbPromise: Promise<Database | null> | null = null;

interface StoredValueRow {
  value: string;
}

export const LOCAL_SAVE_FAILED_EVENT = 'keyvideo:local-save-failed';

export interface LocalVideoAsset {
  id: string;
  name: string;
  src: string;
  desc: string;
  duration?: number;
}

if (isTauri) {
  sqliteDbPromise = (async () => {
    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      const db = await Database.load('sqlite:keyvideo.db');
      
      // Initialize tables
      await db.execute('CREATE TABLE IF NOT EXISTS keyvalue_store (key TEXT PRIMARY KEY, value TEXT)');
      await db.execute('CREATE TABLE IF NOT EXISTS local_video_assets (id TEXT PRIMARY KEY, name TEXT, src TEXT, desc TEXT, duration REAL, owner_id TEXT)');

      // Tables created by older versions have no owner column. Add it in place
      // so existing rows can be claimed by the account that opens them first.
      const columns = await db.select<Array<{ name: string }>>('PRAGMA table_info(local_video_assets)');
      if (!columns.some(column => column.name === 'owner_id')) {
        await db.execute('ALTER TABLE local_video_assets ADD COLUMN owner_id TEXT');
      }
      await db.execute('CREATE INDEX IF NOT EXISTS idx_local_video_assets_owner ON local_video_assets(owner_id)');

      console.log('SQLite database initialized successfully via Tauri.');
      return db;
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
      return null;
    }
  })();
}

class LocalDB {
  private dbName: string;
  private storeName: string;
  private scope: string | null = null;

  constructor(dbName = 'keyvideo_local_db', storeName = 'keyvalue_store') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  setScope(scope: string | null) {
    this.scope = scope?.trim() || null;
  }

  private scopedKey(key: string): string {
    return this.scope ? `user:${this.scope}:${key}` : key;
  }

  private canReadLegacyData(): boolean {
    if (!this.scope) return false;
    try {
      const ownerKey = 'KEYVIDEO_LOCAL_SCOPE_OWNER';
      const owner = localStorage.getItem(ownerKey);
      if (!owner) {
        localStorage.setItem(ownerKey, this.scope);
        return true;
      }
      return owner === this.scope;
    } catch {
      return false;
    }
  }

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async readKey<T>(key: string): Promise<T | null> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const result = await db.select<StoredValueRow[]>('SELECT value FROM keyvalue_store WHERE key = ?', [key]);
          if (result && result.length > 0) {
            try {
              return JSON.parse(result[0].value) as T;
            } catch {
              return result[0].value as T;
            }
          }
          return null;
        }
      } catch (e) {
        console.error(`SQLite get [${key}] failed:`, e);
      }
    }

    // IndexedDB Fallback
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`LocalDB IndexedDB get [${key}] failed:`, e);
      return null;
    }
  }

  private async writeKey(key: string, val: unknown): Promise<boolean> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const valStr = typeof val === 'string' ? val : JSON.stringify(val);
          await db.execute('INSERT OR REPLACE INTO keyvalue_store (key, value) VALUES (?, ?)', [key, valStr]);
          return true;
        }
      } catch (e) {
        console.error(`SQLite set [${key}] failed:`, e);
      }
    }

    // IndexedDB Fallback
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(val, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`LocalDB IndexedDB set [${key}] failed:`, e);
      return false;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const scoped = this.scopedKey(key);
    const value = await this.readKey<T>(scoped);
    if (value !== null) return value;

    // One-time migration for data written before per-user scoping existed.
    // Only the first user to open the new version claims that legacy data.
    if (scoped !== key && this.canReadLegacyData()) {
      const legacy = await this.readKey<T>(key);
      if (legacy !== null) {
        await this.writeKey(scoped, legacy);
        return legacy;
      }
    }
    return null;
  }

  private reportSaveFailure(key: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_SAVE_FAILED_EVENT, { detail: { key } }));
  }

  async set(key: string, val: unknown): Promise<boolean> {
    const saved = await this.writeKey(this.scopedKey(key), val);
    if (!saved) this.reportSaveFailure(key);
    return saved;
  }

  // SQLite Specific local video asset management (with IndexedDB fallback).
  // Every row is owned by the current scope (or NULL before any account is
  // selected), so switching accounts can never list or delete another user's
  // imported videos.
  private async claimLegacyVideoRows(db: Database): Promise<void> {
    if (!this.scope || !this.canReadLegacyData()) return;
    try {
      const rows = await db.select<Array<{ count: number }>>(
        'SELECT COUNT(*) as count FROM local_video_assets WHERE owner_id IS NULL'
      );
      if (Number(rows?.[0]?.count) > 0) {
        await db.execute('UPDATE local_video_assets SET owner_id = ? WHERE owner_id IS NULL', [this.scope]);
      }
    } catch (e) {
      console.warn('Failed to claim legacy local videos:', e);
    }
  }

  async getLocalVideos(): Promise<LocalVideoAsset[]> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          await this.claimLegacyVideoRows(db);
          if (this.scope) {
            return await db.select<LocalVideoAsset[]>(
              'SELECT * FROM local_video_assets WHERE owner_id = ? ORDER BY rowid DESC',
              [this.scope]
            );
          }
          return await db.select<LocalVideoAsset[]>(
            'SELECT * FROM local_video_assets WHERE owner_id IS NULL ORDER BY rowid DESC'
          );
        }
      } catch (e) {
        console.error('SQLite getLocalVideos failed:', e);
      }
    }

    const val = await this.get<LocalVideoAsset[]>('ai_local_videos');
    return Array.isArray(val) ? val : [];
  }

  async saveLocalVideo(video: LocalVideoAsset): Promise<boolean> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const existing = await db.select<Array<{ owner_id: string | null }>>(
            'SELECT owner_id FROM local_video_assets WHERE id = ?',
            [video.id]
          );
          if (existing.length > 0 && (existing[0].owner_id || null) !== this.scope) {
            console.warn('Refusing to overwrite a local video owned by another account.');
            return false;
          }
          await db.execute(
            'INSERT OR REPLACE INTO local_video_assets (id, name, src, desc, duration, owner_id) VALUES (?, ?, ?, ?, ?, ?)',
            [video.id, video.name, video.src, video.desc, video.duration || 0, this.scope]
          );
          return true;
        }
      } catch (e) {
        console.error('SQLite saveLocalVideo failed:', e);
      }
    }

    const list = await this.getLocalVideos();
    const updated = [...list.filter(v => v.id !== video.id), video];
    return await this.set('ai_local_videos', updated);
  }

  async deleteLocalVideo(id: string): Promise<boolean> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const result = this.scope
            ? await db.execute('DELETE FROM local_video_assets WHERE id = ? AND owner_id = ?', [id, this.scope])
            : await db.execute('DELETE FROM local_video_assets WHERE id = ? AND owner_id IS NULL', [id]);
          return Number(result?.rowsAffected || 0) > 0;
        }
      } catch (e) {
        console.error('SQLite deleteLocalVideo failed:', e);
      }
    }

    const list = await this.getLocalVideos();
    const updated = list.filter(v => v.id !== id);
    return await this.set('ai_local_videos', updated);
  }
}

export const localDB = new LocalDB();
