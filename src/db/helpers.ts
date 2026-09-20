import { getDb } from './client';

// Generic helpers shared by every repository. Table names are always
// internal string literals (never user input), so interpolating them is safe.

export async function insertRow(table: string, data: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => data[c]);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    values as any[]
  );
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
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
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
