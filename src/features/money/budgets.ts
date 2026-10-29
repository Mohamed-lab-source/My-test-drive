import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { computeBudgetStatuses } from './budgetCore';
import type { BudgetStatus } from '../../utils/budgets';

// Every budget's status, recomputed when budgets, transactions or the
// period settings change. Empty until the first load finishes.
export function useBudgetStatuses(): Record<string, BudgetStatus> {
  const { budgets, transactions, fxRates } = useFinanceStore(useShallow((s) => ({ budgets: s.budgets, transactions: s.transactions, fxRates: s.fxRates })));
  // Re-run when the month setting changes (it's applied app-wide).
  const monthStartDay = useSettingsStore((s) => s.monthStartDay);
  const usePaydays = useSettingsStore((s) => s.monthFromPayday);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  useEffect(() => {
    let live = true;
    computeBudgetStatuses(budgets, new Date(), { weekStart }, fxRates)
      .then((s) => live && setStatuses(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [budgets, transactions, fxRates, monthStartDay, usePaydays, weekStart]);
  return statuses;
}
