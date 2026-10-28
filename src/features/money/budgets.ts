import { useEffect, useState } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { computeBudgetStatuses } from './budgetCore';
import type { BudgetStatus } from '../../utils/budgets';

// Every budget's status, recomputed when budgets, transactions or the
// period settings change. Empty until the first load finishes.
export function useBudgetStatuses(): Record<string, BudgetStatus> {
  const { budgets, transactions, fxRates } = useFinanceStore();
  const monthStartDay = useSettingsStore((s) => s.monthStartDay);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  useEffect(() => {
    let live = true;
    computeBudgetStatuses(budgets, new Date(), { monthStartDay, weekStart }, fxRates)
      .then((s) => live && setStatuses(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [budgets, transactions, fxRates, monthStartDay, weekStart]);
  return statuses;
}
