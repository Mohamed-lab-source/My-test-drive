import type { Transaction } from '../db/types';

export interface FrequentTemplate {
  key: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  count: number;
}

// Income/expense entries logged at least twice with the same amount,
// category and note in the last `days` — the things worth one-tap re-entry.
export function frequentTransactions(transactions: Transaction[], limit = 4, days = 90, now = new Date()): FrequentTemplate[] {
  const since = now.getTime() - days * 86400000;
  const groups = new Map<string, FrequentTemplate & { last: number }>();
  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const when = new Date(t.date).getTime();
    if (when < since) continue;
    const note = t.note?.trim() || null;
    const key = [t.type, t.category_id ?? '', t.amount, (note ?? '').toLowerCase()].join('|');
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (when > g.last) Object.assign(g, { last: when, accountId: t.account_id, note });
    } else {
      groups.set(key, { key, type: t.type, amount: t.amount, categoryId: t.category_id, accountId: t.account_id, note, count: 1, last: when });
    }
  }
  return Array.from(groups.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map(({ last: _last, ...rest }) => rest);
}
