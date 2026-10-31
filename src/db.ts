// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INDEXEDDB
// Асинхронное хранилище для тяжелой памяти Оракула
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'NebulaDB';
const DB_VERSION = 1;
const STORE_NAME = 'oracleMemory';

export const db = {
  _db: null as IDBDatabase | null,

  async init(): Promise<void> {
    return new Promise((resolve) => {
      if (!window.indexedDB) { resolve(); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e: any) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e: any) => {
        this._db = e.target.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  },

  async get(key: string): Promise<any> {
    if (!this._db) return null;
    return new Promise((resolve) => {
      const tx = this._db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },

  async set(key: string, value: any): Promise<void> {
    if (!this._db) return;
    return new Promise((resolve) => {
      const tx = this._db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
};