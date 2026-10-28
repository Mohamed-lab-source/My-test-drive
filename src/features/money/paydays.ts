// Finds your paydays in the last months of income and applies them to the
// app-wide month setting. No stores here, so the widgets can call it too.
import * as repo from '../../db/repositories/finance';
import { detectPaydays, setPaydayMode } from '../../utils/period';

export async function loadPaydays(settings: { monthFromPayday?: boolean; manualPaydays?: string[] }): Promise<Date[]> {
  if (!settings.monthFromPayday) {
    setPaydayMode(false);
    return [];
  }
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 8, 1).toISOString();
  const [txs, categories] = await Promise.all([repo.listTransactionsInRange(since, new Date(now.getTime() + 86400000).toISOString()), repo.listCategories()]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const paydays = detectPaydays(
    txs.filter((t) => t.type === 'income').map((t) => ({ amount: t.amount, date: t.date, note: t.note, category: t.category_id ? names.get(t.category_id) ?? null : null })),
    settings.manualPaydays ?? []
  );
  setPaydayMode(true, paydays);
  return paydays;
}
