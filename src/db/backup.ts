import { getDb } from './client';

const TABLES = [
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
  'habits',
  'habit_logs',
  'prayer_logs',
];

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    dump[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: dump }, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const parsed = JSON.parse(json) as { data: Record<string, Record<string, unknown>[]> };
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      const rows = parsed.data[table];
      if (!rows || rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => '?').join(', ');
        const updateClause = cols.map((c) => `${c} = excluded.${c}`).join(', ');
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updateClause}`,
          cols.map((c) => row[c]) as any[]
        );
      }
    }
  });
}

export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
