// Minimal promise-based IndexedDB wrapper. No external deps.
const DB_NAME = "atomic-habits";
const DB_VERSION = 1;
export const STORES = ["identities", "habits", "checkins", "scorecard"];
let dbPromise = null;
export function openDatabase() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of STORES) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: "id" });
                }
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}
function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
export async function getAll(store) {
    const db = await openDatabase();
    const tx = db.transaction(store, "readonly");
    return reqToPromise(tx.objectStore(store).getAll());
}
export async function put(store, value) {
    const db = await openDatabase();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
export async function remove(store, id) {
    const db = await openDatabase();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
export async function clearStore(store) {
    const db = await openDatabase();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
export async function putAll(store, values) {
    const db = await openDatabase();
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    for (const value of values)
        objectStore.put(value);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
//# sourceMappingURL=idb.js.map