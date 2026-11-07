import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import type { SpendingPlan } from '../../utils/spendingPlan';
import { computePlanWith } from './planCore';
import { currentMonthStart } from '../../utils/period';

// Gathers everything the plan needs from the database and stores.
export async function computePlan(now: Date = new Date()): Promise<SpendingPlan> {
  const s = useSettingsStore.getState();
  const f = useFinanceStore.getState();
  return computePlanWith(now, {
    settings: s,
    fxRates: f.fxRates,
    recurringRules: f.recurringRules,
    savingsGoals: f.savingsGoals,
  });
}

// The plan for screens, recomputed whenever money data or settings change.
export function useSpendingPlan(): SpendingPlan | null {
  const [plan, setPlan] = useState<SpendingPlan | null>(null);
  const { transactions, recurringRules, savingsGoals, fxRates } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, recurringRules: s.recurringRules, savingsGoals: s.savingsGoals, fxRates: s.fxRates })));
  const deps = useSettingsStore((s) => [s.monthlyIncome, s.savingsPct, s.monthlyLimit, s.weeklyLimit, s.dailySpendAlert, s.weekStart, s.currency].join('|'));
  useEffect(() => {
    let live = true;
    sharedPlan([transactions, recurringRules, savingsGoals, fxRates, deps])
      .then((p) => live && setPlan(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [transactions, recurringRules, savingsGoals, fxRates, deps]);
  return plan;
}

// Home and Money show the plan in several places at once; they share one
// calculation per change instead of each querying the database.
let lastInputs: unknown[] | null = null;
let lastPlan: Promise<SpendingPlan> | null = null;
function sharedPlan(inputs: unknown[]): Promise<SpendingPlan> {
  const same = lastInputs && lastPlan && lastInputs.length === inputs.length && lastInputs.every((x, i) => x === inputs[i]);
  if (!same) {
    lastInputs = inputs;
    lastPlan = computePlan();
  }
  return lastPlan!;
}

export interface PlanExtras {
  nextPayday: Date | null;
  daysToPayday: number | null;
  noSpendDays: number;
  noSpendStreak: number;
  weekdayAvg: number;
  weekendAvg: number;
  emergencyTarget: number;
  emergencySaved: number;
  topCategories: { name: string; color: string; total: number; share: number }[];
  biggest: { note: string; amount: number; date: string } | null;
}

// Extra context for the plan, worked out from recent transactions.
export function usePlanExtras(plan: SpendingPlan | null): PlanExtras | null {
  const [extras, setExtras] = useState<PlanExtras | null>(null);
  const { transactions, accounts, categories, fxRates } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, accounts: s.accounts, categories: s.categories, fxRates: s.fxRates })));
  const { currency, weekendDays } = useSettingsStore(useShallow((s) => ({ currency: s.currency, weekendDays: s.weekendDays })));
  useEffect(() => {
    if (!plan) return;
    (async () => {
      const now = new Date();
      const toBase = (a: number, c: string) => convertToBase(a, c, currency, fxRates);
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 100);
      const txs = await repo.listTransactionsInRange(since.toISOString(), new Date(now.getTime() + 86400000).toISOString());
      const dayKey = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      };

      // Payday: the larger incomes (at least half the biggest), and the
      // usual gap between them.
      const incomes = txs.filter((t) => t.type === 'income').map((t) => ({ at: new Date(t.date), amount: toBase(t.amount, t.currency) }));
      const top = Math.max(0, ...incomes.map((i) => i.amount));
      const paydays = incomes.filter((i) => i.amount >= top * 0.5).sort((a, b) => a.at.getTime() - b.at.getTime());
      let nextPayday: Date | null = null;
      if (paydays.length) {
        const last = paydays[paydays.length - 1].at;
        const gaps = paydays.slice(1).map((p, i) => (p.at.getTime() - paydays[i].at.getTime()) / 86400000).filter((g) => g > 20);
        const gap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        nextPayday = gap ? new Date(last.getTime() + gap * 86400000) : new Date(last.getFullYear(), last.getMonth() + 1, last.getDate());
        while (nextPayday.getTime() < now.getTime()) nextPayday = new Date(nextPayday.getFullYear(), nextPayday.getMonth() + 1, nextPayday.getDate());
      }
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const daysToPayday = nextPayday ? Math.max(0, Math.round((new Date(nextPayday.getFullYear(), nextPayday.getMonth(), nextPayday.getDate()).getTime() - today0) / 86400000)) : null;

      const spend = txs.filter((t) => t.type === 'expense' && !t.recurring_id);
      const spendDays = new Set(spend.map((t) => dayKey(t.date)));
      let noSpendDays = 0;
      for (let d = 1; d <= now.getDate(); d++) if (!spendDays.has(`${now.getFullYear()}-${now.getMonth()}-${d}`)) noSpendDays++;
      let noSpendStreak = 0;
      for (let i = 0; i < 100; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        if (spendDays.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) break;
        noSpendStreak++;
      }

      // Average day over the last 4 weeks, split by weekday / weekend.
      const totals = { wd: 0, we: 0 };
      const counts = { wd: 0, we: 0 };
      for (let i = 1; i <= 28; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const k = weekendDays.includes(d.getDay()) ? 'we' : 'wd';
        counts[k]++;
        totals[k] += spend.filter((t) => dayKey(t.date) === `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`).reduce((s, t) => s + toBase(t.amount, t.currency), 0);
      }

      const monthStart = currentMonthStart(now).getTime();
      const month = spend.filter((t) => new Date(t.date).getTime() >= monthStart);
      const byCat = new Map<string, number>();
      for (const t of month) byCat.set(t.category_id ?? '', (byCat.get(t.category_id ?? '') ?? 0) + toBase(t.amount, t.currency));
      const monthTotal = [...byCat.values()].reduce((a, b) => a + b, 0);
      const topCategories = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id, total]) => {
          const c = categories.find((x) => x.id === id);
          return { name: c?.name ?? 'Uncategorised', color: c?.color ?? '#8E8E93', total, share: monthTotal ? total / monthTotal : 0 };
        });
      const big = [...month].sort((a, b) => toBase(b.amount, b.currency) - toBase(a.amount, a.currency))[0];

      setExtras({
        nextPayday,
        daysToPayday,
        noSpendDays,
        noSpendStreak,
        weekdayAvg: counts.wd ? totals.wd / counts.wd : 0,
        weekendAvg: counts.we ? totals.we / counts.we : 0,
        // Three months of bills and everyday spending.
        emergencyTarget: (plan.bills + plan.monthly.limit) * 3,
        emergencySaved: accounts.filter((a) => a.type === 'savings' && !a.is_archived).reduce((s, a) => s + Math.max(0, toBase(a.balance, a.currency)), 0),
        topCategories,
        biggest: big ? { note: big.note ?? 'Expense', amount: toBase(big.amount, big.currency), date: big.date } : null,
      });
    })().catch(() => {});
  }, [plan, transactions, accounts, categories, fxRates, currency, weekendDays]);
  return extras;
}
