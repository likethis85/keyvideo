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
