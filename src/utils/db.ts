// localDB - keyvalue store with SQLite backend in Tauri and IndexedDB fallback in browser

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

let sqliteDbPromise: Promise<any> | null = null;

if (isTauri) {
  sqliteDbPromise = (async () => {
    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      const db = await Database.load('sqlite:keyvideo.db');
      
      // Initialize tables
      await db.execute('CREATE TABLE IF NOT EXISTS keyvalue_store (key TEXT PRIMARY KEY, value TEXT)');
      await db.execute('CREATE TABLE IF NOT EXISTS local_video_assets (id TEXT PRIMARY KEY, name TEXT, src TEXT, desc TEXT, duration REAL)');
      
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

  constructor(dbName = 'keyvideo_local_db', storeName = 'keyvalue_store') {
    this.dbName = dbName;
    this.storeName = storeName;
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

  async get(key: string): Promise<any> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const result: any[] = await db.select('SELECT value FROM keyvalue_store WHERE key = ?', [key]);
          if (result && result.length > 0) {
            try {
              return JSON.parse(result[0].value);
            } catch (e) {
              return result[0].value;
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
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`LocalDB IndexedDB get [${key}] failed:`, e);
      return null;
    }
  }

  async set(key: string, val: any): Promise<boolean> {
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

  // SQLite Specific local video asset management (with IndexedDB fallback)
  async getLocalVideos(): Promise<any[]> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          const rows: any[] = await db.select('SELECT * FROM local_video_assets');
          return rows;
        }
      } catch (e) {
        console.error('SQLite getLocalVideos failed:', e);
      }
    }

    const val = await this.get('ai_local_videos');
    return Array.isArray(val) ? val : [];
  }

  async saveLocalVideo(video: { id: string; name: string; src: string; desc: string; duration?: number }): Promise<boolean> {
    if (isTauri) {
      try {
        const db = await sqliteDbPromise;
        if (db) {
          await db.execute(
            'INSERT OR REPLACE INTO local_video_assets (id, name, src, desc, duration) VALUES (?, ?, ?, ?, ?)',
            [video.id, video.name, video.src, video.desc, video.duration || 0]
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
          await db.execute('DELETE FROM local_video_assets WHERE id = ?', [id]);
          return true;
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
