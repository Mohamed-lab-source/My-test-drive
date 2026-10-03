// Writes go straight to SQLite rather than through insertRow/updateRow, so
// the cloud-sync hook never sees raw SMS content.
import { getDb, nowIso } from '../client';
import type { SmsImport, SmsImportStatus } from '../types';

export async function listSmsImports(status?: SmsImportStatus): Promise<SmsImport[]> {
  const db = await getDb();
  return status
    ? db.getAllAsync<SmsImport>('SELECT * FROM sms_imports WHERE status = ? ORDER BY sms_date DESC', [status])
    : db.getAllAsync<SmsImport>('SELECT * FROM sms_imports ORDER BY sms_date DESC LIMIT 200');
}

// Returns true when the row was new.
export async function insertSmsImport(row: Omit<SmsImport, 'status' | 'created_at'>): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO sms_imports
      (id, sms_date, sender, body, amount, currency, merchant, card_last4, kind, balance, balance_currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      row.id,
      row.sms_date,
      row.sender,
      row.body,
      row.amount,
      row.currency,
      row.merchant,
      row.card_last4,
      row.kind,
      row.balance ?? null,
      row.balance_currency ?? null,
      nowIso(),
    ]
  );
  return result.changes > 0;
}

export async function setSmsImportStatus(id: string, status: SmsImportStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sms_imports SET status = ? WHERE id = ?', [status, id]);
}

// The most recent balance any bank SMS reported.
export async function latestReportedBalance(): Promise<{ amount: number; currency: string; date: string } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ balance: number; balance_currency: string; sms_date: string }>(
    'SELECT balance, balance_currency, sms_date FROM sms_imports WHERE balance IS NOT NULL ORDER BY sms_date DESC LIMIT 1'
  );
  return row ? { amount: row.balance, currency: row.balance_currency, date: row.sms_date } : null;
}
