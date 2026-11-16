// Tiny IndexedDB wrapper: one store for trips, one for photo blobs.
let conn;
function open() {
  return conn ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('offline-album', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('trips', { keyPath: 'id' });
      req.result.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(store, mode, fn) {
  return open().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  }));
}

export const db = {
  all: store => run(store, 'readonly', s => s.getAll()),
  get: (store, id) => run(store, 'readonly', s => s.get(id)),
  put: (store, value) => run(store, 'readwrite', s => s.put(value)),
  del: (store, id) => run(store, 'readwrite', s => s.delete(id)),
};

export const uid = () =>
  crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
