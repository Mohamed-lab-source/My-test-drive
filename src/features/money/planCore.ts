// The spending plan from plain data, without the app's stores, so the
// home-screen widgets can compute it while the app isn't running.
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { buildSpendingPlan, type SpendingPlan } from '../../utils/spendingPlan';
import { monthPeriod } from '../../utils/period';
import type { FxRate, RecurringRule, SavingsGoal } from '../../db/types';

export interface PlanSettings {
  currency: string;
  weekStart: number;
  monthlyIncome: number;
  savingsPct: number;
  dailySpendAlert: number;
  weeklyLimit: number;
  monthlyLimit: number;
  monthStartDay?: number;
}

export interface PlanSource {
  settings: PlanSettings;
  fxRates: FxRate[];
  recurringRules: RecurringRule[];
  savingsGoals: SavingsGoal[];
}

// Day-to-day spending (bills excluded) since a date, in the base currency.
function variableSpend(txs: { type: string; amount: number; currency: string; recurring_id: string | null; date: string }[], since: Date, toBase: (a: number, c: string) => number) {
  return txs
    .filter((t) => t.type === 'expense' && !t.recurring_id && new Date(t.date).getTime() >= since.getTime())
    .reduce((s, t) => s + toBase(t.amount, t.currency), 0);
}

export async function computePlanWith(now: Date, { settings: s, fxRates, recurringRules, savingsGoals }: PlanSource): Promise<SpendingPlan> {
  const toBase = (a: number, c: string) => convertToBase(a, c, s.currency, fxRates);

  const startDay = s.monthStartDay ?? 1;
  const monthStart = monthPeriod(now, 0, startDay).start;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() - s.weekStart + 7) % 7));
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const historyStart = monthPeriod(now, -3, startDay).start;
  const from = weekStart < monthStart ? weekStart : monthStart;

  const [recent, history] = await Promise.all([
    repo.listTransactionsInRange(from.toISOString(), new Date(now.getTime() + 86400000).toISOString()),
    repo.listTransactionsInRange(historyStart.toISOString(), monthStart.toISOString()),
  ]);
  const incomeHistory = [1, 2, 3].map((back) => {
    const { start: s0, end: e0 } = monthPeriod(now, -back, startDay);
    const start = s0.getTime();
    const end = e0.getTime();
    return history
      .filter((t) => t.type === 'income' && new Date(t.date).getTime() >= start && new Date(t.date).getTime() < end)
      .reduce((sum, t) => sum + toBase(t.amount, t.currency), 0);
  });

  return buildSpendingPlan({
    now,
    monthlyIncome: s.monthlyIncome,
    incomeHistory,
    bills: recurringRules
      .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
      .map((r) => ({ amount: toBase(r.amount, r.currency), frequency: r.frequency, interval: r.interval_count || 1 })),
    goals: savingsGoals
      .filter((g) => !g.is_completed)
      .map((g) => ({ name: g.name, remaining: toBase(g.target_amount - g.current_amount, g.currency), targetDate: g.target_date })),
    savingsPct: s.savingsPct,
    spentThisMonth: variableSpend(recent, monthStart, toBase),
    spentThisWeek: variableSpend(recent, weekStart, toBase),
    spentToday: variableSpend(recent, dayStart, toBase),
    weekStart: s.weekStart,
    limits: { daily: s.dailySpendAlert, weekly: s.weeklyLimit, monthly: s.monthlyLimit },
    monthStartDay: startDay,
  });
}
