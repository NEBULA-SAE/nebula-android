// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INDEXEDDB (v2: миграции, авто-инициализация, multi-store)
// Асинхронное хранилище для памяти Оракула и кэша свечей
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'NebulaDB';
const DB_VERSION = 2;

export type StoreName = 'oracleMemory' | 'candlesCache' | 'meta';

const STORES: StoreName[] = ['oracleMemory', 'candlesCache', 'meta'];

export const db = {
  _db: null as IDBDatabase | null,
  _initPromise: null as Promise<IDBDatabase | null> | null,

  async _ensureDB(): Promise<IDBDatabase | null> {
    if (this._db) return this._db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise<IDBDatabase | null>((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        // Миграции схемы (v1 → v2 и дальше)
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const d = (e.target as IDBOpenDBRequest).result;
          for (const store of STORES) {
            if (!d.objectStoreNames.contains(store)) {
              d.createObjectStore(store);
            }
          }
        };

        req.onsuccess = (e: Event) => {
          const d = (e.target as IDBOpenDBRequest).result;
          // Защита от блокировки при открытии в нескольких вкладках
          d.onversionchange = () => {
            d.close();
            this._db = null;
            this._initPromise = null;
          };
          this._db = d;
          resolve(d);
        };

        req.onerror = () => {
          this._initPromise = null;
          resolve(null);
        };

        req.onblocked = () => {
          resolve(null);
        };
      } catch {
        this._initPromise = null;
        resolve(null);
      }
    });

    return this._initPromise;
  },

  async init(): Promise<void> {
    await this._ensureDB();
  },

  async get<T = any>(key: string, storeName: StoreName = 'oracleMemory'): Promise<T | null> {
    const d = await this._ensureDB();
    if (!d) return null;

    return new Promise((resolve) => {
      try {
        const tx = d.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  async set(key: string, value: any, storeName: StoreName = 'oracleMemory'): Promise<boolean> {
    const d = await this._ensureDB();
    if (!d) return false;

    return new Promise((resolve) => {
      try {
        const tx = d.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },

  async del(key: string, storeName: StoreName = 'oracleMemory'): Promise<void> {
    const d = await this._ensureDB();
    if (!d) return;

    return new Promise((resolve) => {
      try {
        const tx = d.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  async clear(storeName: StoreName = 'oracleMemory'): Promise<void> {
    const d = await this._ensureDB();
    if (!d) return;

    return new Promise((resolve) => {
      try {
        const tx = d.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Автоочистка самых старых записей в хранилище (удобно для candlesCache)
   * Ожидает, что у сохранённых объектов есть числовое поле `ts`.
   */
  async prune(storeName: StoreName, maxItems: number): Promise<void> {
    const d = await this._ensureDB();
    if (!d) return;

    return new Promise((resolve) => {
      try {
        const tx = d.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const items: { key: IDBValidKey; ts: number }[] = [];

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e: Event) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            items.push({ key: cursor.key, ts: Number(cursor.value?.ts) || 0 });
            cursor.continue();
          } else {
            if (items.length > maxItems) {
              items.sort((a, b) => a.ts - b.ts);
              const excess = items.length - maxItems;
              for (let i = 0; i < excess; i++) {
                store.delete(items[i].key);
              }
            }
            resolve();
          }
        };
        cursorReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};