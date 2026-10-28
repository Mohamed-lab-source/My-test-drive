import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, COLUMN_MIGRATIONS } from './schema';

const DB_NAME = 'anchor.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrateColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    const existingCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!existingCols.some((c) => c.name === column)) {
      await db.execAsync(ddl);
    }
  }
}

// Budgets used to be one per category (category_id NOT NULL UNIQUE). Now a
// budget can cover several categories or everything, so rebuild the table
// once without that constraint, keeping every existing budget.
async function relaxBudgets(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(budgets)');
  if (!cols.find((c) => c.name === 'category_id')?.notnull) return;
  await db.execAsync(`
PRAGMA foreign_keys = OFF;
BEGIN;
CREATE TABLE budgets_relaxed (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT,
  monthly_limit INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL
);
INSERT INTO budgets_relaxed (id, category_id, monthly_limit, currency, created_at)
  SELECT id, category_id, monthly_limit, currency, created_at FROM budgets;
DROP TABLE budgets;
ALTER TABLE budgets_relaxed RENAME TO budgets;
COMMIT;
PRAGMA foreign_keys = ON;
`);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(CREATE_TABLES_SQL);
      await relaxBudgets(db);
      await migrateColumns(db);
      return db;
    });
  }
  return dbPromise;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
