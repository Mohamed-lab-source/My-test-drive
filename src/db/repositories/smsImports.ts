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
      (id, sms_date, sender, body, amount, currency, merchant, card_last4, kind, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [row.id, row.sms_date, row.sender, row.body, row.amount, row.currency, row.merchant, row.card_last4, row.kind, nowIso()]
  );
  return result.changes > 0;
}

export async function setSmsImportStatus(id: string, status: SmsImportStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sms_imports SET status = ? WHERE id = ?', [status, id]);
}
