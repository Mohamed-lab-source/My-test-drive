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

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(CREATE_TABLES_SQL);
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
