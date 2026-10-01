import type { RecurringRule, Transaction } from '../db/types';

export interface RecurringSuggestion {
  key: string;
  name: string;
  amount: number;
  currency: string;
  categoryId: string | null;
  accountId: string | null;
  lastDate: string;
  count: number;
}

// Expenses with the same note, a near-identical amount (±10%) and roughly
// monthly gaps (25–35 days) at least three times in the last ~4 months,
// that aren't already tracked as a recurring item.
export function detectRecurring(transactions: Transaction[], rules: RecurringRule[], now: Date = new Date()): RecurringSuggestion[] {
  const since = now.getTime() - 125 * 86400000;
  const tracked = new Set(rules.map((r) => r.name.trim().toLowerCase()));
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.note?.trim() || new Date(t.date).getTime() < since) continue;
    const key = t.note.trim().toLowerCase();
    if (tracked.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: RecurringSuggestion[] = [];
  for (const [key, txs] of groups) {
    if (txs.length < 3) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const base = sorted[sorted.length - 1].amount;
    if (!sorted.every((t) => Math.abs(t.amount - base) <= base * 0.1)) continue;
    const gaps = sorted.slice(1).map((t, i) => (new Date(t.date).getTime() - new Date(sorted[i].date).getTime()) / 86400000);
    if (!gaps.every((g) => g >= 25 && g <= 35)) continue;
    const last = sorted[sorted.length - 1];
    out.push({
      key,
      name: last.note!.trim(),
      amount: last.amount,
      currency: last.currency,
      categoryId: last.category_id,
      accountId: last.account_id,
      lastDate: last.date,
      count: sorted.length,
    });
  }
  return out;
}
