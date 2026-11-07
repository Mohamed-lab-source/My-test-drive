// Everything you owe — card balances and loans — and the plan to clear it.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoneyWhole } from '../../utils/money';
import { monthPeriod } from '../../utils/period';
import { minimumFor, simulatePayoff, type PayoffDebt } from '../../utils/debtFree';

export interface PlanDebt extends PayoffDebt {
  dueDay: number | null;
  dueDate: string | null;
  // Missing information that makes the numbers less accurate.
  missingRate: boolean;
  accountId: string | null;
  debtId: string | null;
}

export function useDebtPlan() {
  const { accounts, debts, transactions, fxRates } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, debts: s.debts, transactions: s.transactions, fxRates: s.fxRates })));
  const { currency, plan, terms } = useSettingsStore(useShallow((s) => ({ currency: s.currency, plan: s.debtPlan, terms: s.debtTerms })));

  return useMemo(() => {
    const toBase = (a: number, c: string) => convertToBase(a, c, currency, fxRates);
    const fmt = (m: number) => formatMoneyWhole(m, currency);
    const list: PlanDebt[] = [
      ...accounts
        .filter((a) => a.type === 'credit' && !a.is_archived && a.balance < 0)
        .map((a) => ({
          id: `card:${a.id}`,
          name: a.name,
          kind: 'card' as const,
          balance: toBase(-a.balance, a.currency),
          apr: a.apr ?? 0,
          minPct: a.min_payment_pct ?? 5,
          fixedMin: 0,
          dueDay: a.due_day ?? null,
          dueDate: null,
          missingRate: !a.apr,
          accountId: a.id,
          debtId: null,
        })),
      ...debts
        .filter((d) => d.direction === 'i_owe' && d.status !== 'paid' && d.remaining_amount > 0)
        .map((d) => ({
          id: `debt:${d.id}`,
          name: d.person_name,
          kind: 'loan' as const,
          balance: toBase(d.remaining_amount, d.currency),
          apr: terms[d.id]?.apr ?? 0,
          minPct: 0,
          fixedMin: terms[d.id]?.min ?? 0,
          dueDay: null,
          dueDate: d.due_date,
          missingRate: false,
          accountId: null,
          debtId: d.id,
        })),
    ];
    const total = list.reduce((s, d) => s + d.balance, 0);
    const minimums = list.reduce((s, d) => s + minimumFor(d, d.balance), 0);
    const strategy = plan?.strategy ?? 'avalanche';
    const budget = Math.max(plan?.budget ?? 0, minimums);
    const result = simulatePayoff(list, budget, strategy);
    const other = simulatePayoff(list, budget, strategy === 'avalanche' ? 'snowball' : 'avalanche');
    // Paying only the minimums (debts that have one).
    const minOnly = simulatePayoff(list.filter((d) => minimumFor(d, d.balance) > 0), null, 'avalanche');
    // Paid toward cards this money month (transfers into them).
    const { start } = monthPeriod(new Date());
    const cardIds = new Set(list.filter((d) => d.accountId).map((d) => d.accountId));
    const paidThisMonth = transactions
      .filter((t) => t.type === 'transfer' && t.transfer_to_account_id && cardIds.has(t.transfer_to_account_id) && new Date(t.date) >= start)
      .reduce((s, t) => s + toBase(t.amount, t.currency), 0);
    const paidOff = plan ? Math.max(0, plan.startTotal - total) : 0;
    return { list, total, minimums, budget, strategy, result, other, minOnly, paidThisMonth, paidOff, plan, fmt, currency };
  }, [accounts, debts, transactions, fxRates, currency, plan, terms]);
}
