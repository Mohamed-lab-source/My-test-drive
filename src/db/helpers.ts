import { getDb } from './client';

// Generic helpers shared by every repository. Table names are always
// internal string literals (never user input), so interpolating them is safe.

// Optional hook the cloud sync layer registers itself into (see
// src/sync/firestoreSync.ts). Kept as an indirection rather than a direct
// import so this low-level db module never depends on the sync/network code.
interface SyncHooks {
  onWrite: (table: string, id: string, data: Record<string, unknown> | null, deleted: boolean) => void;
}
let syncHooks: SyncHooks | null = null;
export function registerSyncHooks(hooks: SyncHooks): void {
  syncHooks = hooks;
}

export async function insertRow(table: string, data: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => data[c]);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    values as any[]
  );
  syncHooks?.onWrite(table, String(data.id), data, false);
}

export async function updateRow(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  const cols = Object.keys(patch);
  if (cols.length === 0) return;
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = [...cols.map((c) => patch[c]), id];
  await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, values as any[]);
  syncHooks?.onWrite(table, id, patch, false);
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  syncHooks?.onWrite(table, id, null, true);
}

// Insert-or-replace used only when pulling rows down from the cloud, so it
// deliberately does NOT fire syncHooks — that would just push straight back
// the data we just pulled.
export async function upsertRow(table: string, data: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => data[c]);
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    values as any[]
  );
}

export async function allRows<T>(table: string, orderBy?: string): Promise<T[]> {
  const db = await getDb();
  const sql = `SELECT * FROM ${table}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
  return db.getAllAsync<T>(sql);
}

export async function whereRows<T>(
  table: string,
  whereClause: string,
  params: unknown[],
  orderBy?: string
): Promise<T[]> {
  const db = await getDb();
  const sql = `SELECT * FROM ${table} WHERE ${whereClause}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
  return db.getAllAsync<T>(sql, params as any[]);
}

export async function getRow<T>(table: string, id: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row ?? null;
}
