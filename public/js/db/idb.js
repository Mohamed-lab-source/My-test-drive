// Minimal promise-based IndexedDB wrapper. No external deps.
//
// Schema evolution here has two distinct layers, and they're not the same
// thing:
//
// - STRUCTURAL changes (a new object store, a new index) belong here, gated
//   by bumping DB_VERSION and adding a branch below keyed on
//   event.oldVersion. There are none yet beyond the initial store creation.
// - FIELD-level changes (a domain type gains a new property) do NOT belong
//   here — onupgradeneeded only runs once, when the version increases, so it
//   can't help with data that arrives later (e.g. a restored JSON backup
//   exported from an older build). Those defaults live in
//   src/db/migrations.ts and are applied on every read in repo.ts instead.
//
// See migrations.ts for that half of the story before adding a field to any
// domain type in src/domain/types.ts.
const DB_NAME = "atomic-habits";
const DB_VERSION = 1;
export const STORES = ["identities", "habits", "checkins", "scorecard"];
let dbPromise = null;
export function openDatabase() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = req.result;
            // event.oldVersion is 0 for a brand-new database. A future structural
            // change adds `if (event.oldVersion < 2) { ... }` etc. here, in order.
            if (event.oldVersion < 1) {
                for (const name of STORES) {
                    if (!db.objectStoreNames.contains(name)) {
                        db.createObjectStore(name, { keyPath: "id" });
                    }
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