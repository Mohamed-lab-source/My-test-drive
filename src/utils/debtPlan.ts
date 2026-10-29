import type { Debt } from '../db/types';

export type DebtStrategy = 'snowball' | 'due';

export interface DebtPlanStep {
  debt: Debt;
  paidOffMonth: number; // 1 = this coming month
}

// Puts a fixed monthly amount toward debts one at a time — smallest balance
// first ("snowball") or earliest due date first — and reports the month each
// is cleared. Leftover money in a month rolls into the next debt.
export function planDebtPayoff(debts: Debt[], monthly: number, strategy: DebtStrategy): DebtPlanStep[] {
  if (monthly <= 0) return [];
  const order = [...debts].sort((a, b) => {
    if (strategy === 'snowball') return a.remaining_amount - b.remaining_amount;
    const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return ad - bd || a.remaining_amount - b.remaining_amount;
  });
  const left = order.map((d) => d.remaining_amount);
  const steps: DebtPlanStep[] = [];
  let i = 0;
  for (let month = 1; month <= 600 && i < order.length; month++) {
    let budget = monthly;
    while (budget > 0 && i < order.length) {
      const pay = Math.min(budget, left[i]);
      left[i] -= pay;
      budget -= pay;
      if (left[i] <= 0) {
        steps.push({ debt: order[i], paidOffMonth: month });
        i++;
      }
    }
  }
  return steps;
}
