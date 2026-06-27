/* ============================================================
   Aletheia — db.js  (v2)
   IndexedDB wrapper. Two stores:
     • thoughts  — metacognitive log entries
     • practices — one daily check-in record per day
   Version 2 adds the practices store with a graceful migration
   from version 1 (which had only thoughts).
   ============================================================ */

(function () {
  'use strict';

  const DB_NAME = 'aletheia';
  const DB_VERSION = 2;
  const STORE_THOUGHTS = 'thoughts';
  const STORE_PRACTICES = 'practices';

  /** @type {IDBDatabase | null} */
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;
        const from = event.oldVersion;

        // v1: thoughts store
        if (from < 1) {
          const t = db.createObjectStore(STORE_THOUGHTS, { keyPath: 'id' });
          t.createIndex('by_createdAt', 'createdAt', { unique: false });
        }

        // v2: practices store (one record per calendar day, key = 'YYYY-MM-DD')
        if (from < 2) {
          if (!db.objectStoreNames.contains(STORE_PRACTICES)) {
            const p = db.createObjectStore(STORE_PRACTICES, { keyPath: 'date' });
            p.createIndex('by_date', 'date', { unique: true });
          }
        }

        if (tx) tx.onerror = () => reject(tx.error || new Error('Upgrade failed.'));
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        _db.onversionchange = () => { _db.close(); _db = null; };
        resolve(_db);
      };

      request.onerror = () => reject(request.error || new Error('Failed to open database.'));
      request.onblocked = () => reject(new Error('Open blocked by another tab. Close other Aletheia tabs.'));
    });
  }

  /* generic single-store runner */
  function run(store, mode, work) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      let result;
      try {
        const req = work(os);
        if (req) req.onsuccess = () => { result = req.result; };
      } catch (err) { reject(err); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
    }));
  }

  /* ---------------- THOUGHTS ---------------- */
  function putThought(record) {
    return run(STORE_THOUGHTS, 'readwrite', (os) => os.put(record)).then(() => record);
  }

  function getAllThoughts() {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_THOUGHTS, 'readonly');
      const index = tx.objectStore(STORE_THOUGHTS).index('by_createdAt');
      const items = [];
      const cur = index.openCursor(null, 'prev'); // newest first
      cur.onsuccess = (e) => {
        const c = e.target.result;
        if (c) { items.push(c.value); c.continue(); } else resolve(items);
      };
      cur.onerror = () => reject(cur.error);
    }));
  }

  function removeThought(id) {
    return run(STORE_THOUGHTS, 'readwrite', (os) => os.delete(id));
  }

  /* ---------------- PRACTICES ---------------- */
  function putPractice(record) {
    return run(STORE_PRACTICES, 'readwrite', (os) => os.put(record)).then(() => record);
  }

  function getPractice(date) {
    return run(STORE_PRACTICES, 'readonly', (os) => os.get(date));
  }

  function getAllPractices() {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRACTICES, 'readonly');
      const req = tx.objectStore(STORE_PRACTICES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  /* ---------------- BULK (export / import) ---------------- */
  function replaceAll(thoughts, practices) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_THOUGHTS, STORE_PRACTICES], 'readwrite');
      const t = tx.objectStore(STORE_THOUGHTS);
      const p = tx.objectStore(STORE_PRACTICES);
      t.clear(); p.clear();
      (thoughts || []).forEach((r) => t.put(r));
      (practices || []).forEach((r) => p.put(r));
      tx.oncomplete = () => resolve({ thoughts: (thoughts || []).length, practices: (practices || []).length });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  window.AletheiaDB = {
    open,
    putThought, getAllThoughts, removeThought,
    putPractice, getPractice, getAllPractices,
    replaceAll,
    DB_NAME, DB_VERSION,
  };
})();
