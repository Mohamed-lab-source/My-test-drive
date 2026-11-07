import type { Transaction } from '../db/types';
import { localDateKey } from './date';

// Transactions that look entered twice: same type, amount and account
// within 5 minutes, or the same amount and note on the same day.
export function findDuplicateIds(transactions: Transaction[]): Set<string> {
  const ids = new Set<string>();
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const gap = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (gap > 86400000) break;
      if (a.type !== b.type || a.amount !== b.amount) continue;
      const close = gap <= 5 * 60000 && a.account_id === b.account_id;
      const sameNoteSameDay =
        !!a.note && a.note.trim().toLowerCase() === (b.note ?? '').trim().toLowerCase() && localDateKey(a.date) === localDateKey(b.date);
      if (close || sameNoteSameDay) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}
