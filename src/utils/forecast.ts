import { advanceDueDate } from '../db/repositories/finance';
import { convertToBase } from '../db/repositories/fx';
import type { FxRate, RecurringRule } from '../db/types';

export interface ForecastEvent {
  date: string;
  name: string;
  delta: number;
}

export interface Forecast {
  endBalance: number;
  lowBalance: number;
  lowDate: string | null;
  events: ForecastEvent[];
}

// Projects the balance forward by expanding each active, unpaused recurring
// rule into its occurrences within the window. Includes anything already
// overdue (it still has to be paid). One-off spending isn't predictable, so
// this is the floor set by known commitments, not a full prediction.
export function forecastCashFlow(
  startBalance: number,
  rules: RecurringRule[],
  days: number,
  baseCurrency: string,
  fxRates: FxRate[],
  now: Date = new Date()
): Forecast {
  const horizon = new Date(now.getTime() + days * 86400000);
  const events: ForecastEvent[] = [];

  for (const rule of rules) {
    if (!rule.is_active || rule.is_paused) continue;
    const amount = convertToBase(rule.amount, rule.currency, baseCurrency, fxRates);
    const delta = rule.type === 'income' ? amount : -amount;
    let due = rule.next_due_date;
    for (let i = 0; i < 400 && new Date(due) <= horizon; i++) {
      if (rule.end_date && new Date(due) > new Date(rule.end_date)) break;
      events.push({ date: due, name: rule.name, delta });
      due = advanceDueDate(due, rule.frequency, rule.interval_count);
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  let balance = startBalance;
  let lowBalance = startBalance;
  let lowDate: string | null = null;
  for (const e of events) {
    balance += e.delta;
    if (balance < lowBalance) {
      lowBalance = balance;
      lowDate = e.date;
    }
  }
  return { endBalance: balance, lowBalance, lowDate, events };
}
