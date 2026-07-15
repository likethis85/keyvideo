class LocalDB {
  private dbName: string;
  private storeName: string;
  private tauriDb: any = null;

  constructor(dbName = 'keyvideo_local_db', storeName = 'keyvalue_store') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async getTauriDB() {
    if (this.tauriDb) return this.tauriDb;
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        const Database = (await import('@tauri-apps/plugin-sql')).default;
        const db = await Database.load(`sqlite:${this.dbName}.db`);
        await db.execute(`
          CREATE TABLE IF NOT EXISTS ${this.storeName} (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);
        this.tauriDb = db;
        return db;
      }
    } catch (err) {
      console.warn('Failed to load Tauri SQL database, falling back to IndexedDB:', err);
    }
    return null;
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
    const tDb = await this.getTauriDB();
    if (tDb) {
      try {
        const results = (await tDb.select(`SELECT value FROM ${this.storeName} WHERE key = ?`, [key])) as any[];
        if (results && results.length > 0) {
          return JSON.parse(results[0].value);
        }
        return null;
      } catch (e) {
        console.error(`Tauri SQLite get [${key}] failed:`, e);
        return null;
      }
    }

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
      console.error(`LocalDB get [${key}] failed:`, e);
      return null;
    }
  }

  async set(key: string, val: any): Promise<boolean> {
    const tDb = await this.getTauriDB();
    if (tDb) {
      try {
        const jsonVal = JSON.stringify(val);
        await tDb.execute(`
          INSERT INTO ${this.storeName} (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `, [key, jsonVal]);
        return true;
      } catch (e) {
        console.error(`Tauri SQLite set [${key}] failed:`, e);
        return false;
      }
    }

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
      console.error(`LocalDB set [${key}] failed:`, e);
      return false;
    }
  }
}

export const localDB = new LocalDB();
