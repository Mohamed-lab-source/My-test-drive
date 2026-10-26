import { useEffect, useState } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { buildSpendingPlan, type SpendingPlan } from '../../utils/spendingPlan';

// Day-to-day spending (bills excluded) since a date, in the base currency.
function variableSpend(txs: { type: string; amount: number; currency: string; recurring_id: string | null; date: string }[], since: Date, toBase: (a: number, c: string) => number) {
  return txs
    .filter((t) => t.type === 'expense' && !t.recurring_id && new Date(t.date).getTime() >= since.getTime())
    .reduce((s, t) => s + toBase(t.amount, t.currency), 0);
}

// Gathers everything the plan needs from the database and stores.
export async function computePlan(now: Date = new Date()): Promise<SpendingPlan> {
  const s = useSettingsStore.getState();
  const f = useFinanceStore.getState();
  const toBase = (a: number, c: string) => convertToBase(a, c, s.currency, f.fxRates);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() - s.weekStart + 7) % 7));
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const from = weekStart < monthStart ? weekStart : monthStart;

  const [recent, history] = await Promise.all([
    repo.listTransactionsInRange(from.toISOString(), new Date(now.getTime() + 86400000).toISOString()),
    repo.listTransactionsInRange(historyStart.toISOString(), monthStart.toISOString()),
  ]);
  const incomeHistory = [1, 2, 3].map((back) => {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1).getTime();
    return history
      .filter((t) => t.type === 'income' && new Date(t.date).getTime() >= start && new Date(t.date).getTime() < end)
      .reduce((sum, t) => sum + toBase(t.amount, t.currency), 0);
  });

  return buildSpendingPlan({
    now,
    monthlyIncome: s.monthlyIncome,
    incomeHistory,
    bills: f.recurringRules
      .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
      .map((r) => ({ amount: toBase(r.amount, r.currency), frequency: r.frequency, interval: r.interval_count || 1 })),
    goals: f.savingsGoals
      .filter((g) => !g.is_completed)
      .map((g) => ({ name: g.name, remaining: toBase(g.target_amount - g.current_amount, g.currency), targetDate: g.target_date })),
    savingsPct: s.savingsPct,
    spentThisMonth: variableSpend(recent, monthStart, toBase),
    spentThisWeek: variableSpend(recent, weekStart, toBase),
    spentToday: variableSpend(recent, dayStart, toBase),
    weekStart: s.weekStart,
    limits: { daily: s.dailySpendAlert, weekly: s.weeklyLimit, monthly: s.monthlyLimit },
  });
}

// The plan for screens, recomputed whenever money data or settings change.
export function useSpendingPlan(): SpendingPlan | null {
  const [plan, setPlan] = useState<SpendingPlan | null>(null);
  const { transactions, recurringRules, savingsGoals, fxRates } = useFinanceStore();
  const deps = useSettingsStore((s) => [s.monthlyIncome, s.savingsPct, s.monthlyLimit, s.weeklyLimit, s.dailySpendAlert, s.weekStart, s.currency].join('|'));
  useEffect(() => {
    computePlan().then(setPlan).catch(() => {});
  }, [transactions, recurringRules, savingsGoals, fxRates, deps]);
  return plan;
}
