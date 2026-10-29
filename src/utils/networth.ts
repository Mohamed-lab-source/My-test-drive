import { convertToBase } from '../db/repositories/fx';
import type { FxRate, Transaction } from '../db/types';

// Approximates net worth at each of the last `days` days by walking the
// current total backwards through income/expense transactions since then
// (transfers net to zero across the whole portfolio, so they're skipped).
// It's a reconstruction from transaction history, not a stored snapshot —
// good enough for a trend sparkline, not exact accounting.
export function reconstructNetWorthTrend(
  currentNetWorth: number,
  transactions: Transaction[],
  days: number,
  baseCurrency: string,
  fxRates: FxRate[]
): number[] {
  const now = new Date();
  const points: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const futureDelta = transactions
      .filter((t) => t.type !== 'transfer' && new Date(t.date) >= cutoff)
      .reduce((sum, t) => {
        const converted = convertToBase(t.amount, t.currency, baseCurrency, fxRates);
        return sum + (t.type === 'income' ? converted : -converted);
      }, 0);
    points.push(currentNetWorth - futureDelta);
  }
  return points;
}
