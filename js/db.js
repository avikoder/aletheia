/* ============================================================
   Aletheia — db.js
   A small, dependency-free wrapper around IndexedDB.
   Exposes window.AletheiaDB with a promise-based API and
   graceful version-upgrade handling.
   ============================================================ */

(function () {
  'use strict';

  const DB_NAME = 'aletheia';
  const DB_VERSION = 1;
  const STORE = 'thoughts';

  /** @type {IDBDatabase | null} */
  let _db = null;

  /**
   * Open (and if necessary, create/upgrade) the database.
   * Safe to call repeatedly — resolves the cached handle after first open.
   * @returns {Promise<IDBDatabase>}
   */
  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Runs on first creation and on any version bump.
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;
        const fromVersion = event.oldVersion;

        // --- Version 1: create the thoughts store + indexes ---
        if (fromVersion < 1) {
          const store = db.createObjectStore(STORE, {
            keyPath: 'id',
            autoIncrement: false,
          });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
          store.createIndex('by_emotion', 'emotion', { unique: false });
        }

        // --- Future migrations slot in here as additional guards ---
        // if (fromVersion < 2) { ...modify using `tx`... }

        // Surface migration errors instead of silently failing.
        if (tx) {
          tx.onerror = () => reject(tx.error || new Error('Upgrade transaction failed.'));
        }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;

        // If another tab triggers a version change, close so it isn't blocked.
        _db.onversionchange = () => {
          _db.close();
          _db = null;
        };

        resolve(_db);
      };

      request.onerror = () => reject(request.error || new Error('Failed to open database.'));
      request.onblocked = () => reject(new Error('Database open is blocked by another tab. Please close other Aletheia tabs.'));
    });
  }

  /**
   * Wrap a single object-store operation in a transaction.
   * @param {IDBTransactionMode} mode
   * @param {(store: IDBObjectStore) => IDBRequest} work
   * @returns {Promise<any>}
   */
  function run(mode, work) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          let result;

          try {
            const req = work(store);
            if (req) req.onsuccess = () => { result = req.result; };
          } catch (err) {
            reject(err);
            return;
          }

          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error || new Error('Transaction failed.'));
          tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
        })
    );
  }

  /**
   * Insert or update a thought record.
   * @param {object} record
   * @returns {Promise<object>} the stored record
   */
  function put(record) {
    return run('readwrite', (store) => store.put(record)).then(() => record);
  }

  /**
   * Fetch every thought, newest first.
   * @returns {Promise<object[]>}
   */
  function getAll() {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly');
          const index = tx.objectStore(STORE).index('by_createdAt');
          const items = [];

          // 'prev' walks the index in descending order → newest first.
          const cursorReq = index.openCursor(null, 'prev');
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              items.push(cursor.value);
              cursor.continue();
            } else {
              resolve(items);
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        })
    );
  }

  /**
   * Delete a thought by id.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return run('readwrite', (store) => store.delete(id));
  }

  /**
   * Replace the entire dataset (used by import). Clears then bulk-inserts.
   * @param {object[]} records
   * @returns {Promise<number>} count inserted
   */
  function replaceAll(records) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);

          store.clear();
          records.forEach((r) => store.put(r));

          tx.oncomplete = () => resolve(records.length);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  /**
   * Add many records without clearing (used by merge-import).
   * @param {object[]} records
   * @returns {Promise<number>} count added
   */
  function bulkPut(records) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          records.forEach((r) => store.put(r));
          tx.oncomplete = () => resolve(records.length);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  // Public API
  window.AletheiaDB = { open, put, getAll, remove, replaceAll, bulkPut, DB_NAME, DB_VERSION };
})();
