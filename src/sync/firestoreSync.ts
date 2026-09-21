// Mirrors the app's local SQLite tables into Firestore under
// users/{uid}/{table}/{id}, so a signed-in account's data follows them
// across devices. Local SQLite remains the source of truth the UI reads
// from — this only keeps the cloud copy in sync in the background.
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from '@react-native-firebase/firestore';
import { registerSyncHooks, upsertRow } from '../db/helpers';

export const SYNCED_TABLES = [
  'categories',
  'accounts',
  'recurring_rules',
  'transactions',
  'debts',
  'debt_payments',
  'savings_goals',
  'savings_contributions',
  'wishlist_items',
  'projects',
  'tasks',
  'meetings',
  'prayer_logs',
] as const;

let currentUid: string | null = null;

export function setSyncUser(uid: string | null): void {
  currentUid = uid;
}

registerSyncHooks({
  onWrite(table, id, data, deleted) {
    if (!currentUid || !id) return;
    const db = getFirestore();
    const ref = doc(db, 'users', currentUid, table, id);
    if (deleted) {
      deleteDoc(ref).catch((e) => console.warn(`Firestore delete failed for ${table}/${id}`, e));
    } else if (data) {
      setDoc(ref, data, { merge: true }).catch((e) =>
        console.warn(`Firestore sync failed for ${table}/${id}`, e)
      );
    }
  },
});

// Pulls every synced table down from Firestore and merges it into local
// SQLite. Called right after sign-in so a returning user's data shows up
// on a new device.
export async function pullAllFromCloud(): Promise<void> {
  if (!currentUid) return;
  const db = getFirestore();
  for (const table of SYNCED_TABLES) {
    const snapshot = await getDocs(collection(db, 'users', currentUid, table));
    for (const docSnap of snapshot.docs) {
      await upsertRow(table, { ...docSnap.data(), id: docSnap.id });
    }
  }
}
