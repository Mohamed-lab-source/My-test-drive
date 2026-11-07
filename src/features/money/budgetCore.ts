// Loads what budgets need from the database and works out each one's
// status. No stores here, so the finance store can use it for alerts.
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { budgetCategoryIds, budgetPeriod, budgetStatus, type BudgetStatus, type PeriodOptions } from '../../utils/budgets';
import type { Budget, Category, FxRate } from '../../db/types';

export function budgetName(b: Budget, categories: Pick<Category, 'id' | 'name'>[]): string {
  if (b.name?.trim()) return b.name.trim();
  const names = budgetCategoryIds(b)
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  if (!names.length) return 'All spending';
  return names.length <= 2 ? names.join(' & ') : `${names[0]} & ${names.length - 1} more`;
}

export async function computeBudgetStatuses(
  budgets: Budget[],
  now: Date,
  opts: PeriodOptions,
  fxRates: FxRate[]
): Promise<Record<string, BudgetStatus>> {
  const live = budgets.filter((b) => !b.is_paused);
  if (!live.length) return {};
  // One query covering every budget's current and previous period.
  let from = Infinity;
  let to = -Infinity;
  for (const b of live) {
    const prev = budgetPeriod(b, now, opts, -1);
    const cur = budgetPeriod(b, now, opts);
    from = Math.min(from, prev.start.getTime(), cur.start.getTime());
    to = Math.max(to, cur.end.getTime());
  }
  const txs = await repo.listTransactionsInRange(new Date(from).toISOString(), new Date(to).toISOString());
  const out: Record<string, BudgetStatus> = {};
  for (const b of live) {
    out[b.id] = budgetStatus(b, txs, now, opts, (amount, currency) => convertToBase(amount, currency, b.currency, fxRates));
  }
  return out;
}
