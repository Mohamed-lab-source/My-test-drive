import type { Transaction } from '../db/types';
import { localDateKey } from './date';

export interface SpendingInsight {
  categoryId: string;
  spent: number;
  expected: number;
  change: number; // +0.4 = 40% above the usual pace
}

// Compares each category's spending so far this month with its average over
// the previous three months, scaled to how far through the month we are.
export function spendingInsights(transactions: Transaction[], now: Date = new Date(), threshold = 0.25): SpendingInsight[] {
  const monthKey = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const current = monthKey(0);
  const previous = new Set([monthKey(1), monthKey(2), monthKey(3)]);
  const thisMonth = new Map<string, number>();
  const past = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category_id) continue;
    const key = localDateKey(t.date).slice(0, 7);
    if (key === current) thisMonth.set(t.category_id, (thisMonth.get(t.category_id) ?? 0) + t.amount);
    else if (previous.has(key)) past.set(t.category_id, (past.get(t.category_id) ?? 0) + t.amount);
  }
  const elapsed = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const out: SpendingInsight[] = [];
  for (const [categoryId, total] of past) {
    const expected = (total / 3) * elapsed;
    if (expected <= 0) continue;
    const spent = thisMonth.get(categoryId) ?? 0;
    const change = spent / expected - 1;
    if (Math.abs(change) >= threshold) out.push({ categoryId, spent, expected, change });
  }
  return out.sort((a, b) => Math.abs(b.spent - b.expected) - Math.abs(a.spent - a.expected)).slice(0, 4);
}
