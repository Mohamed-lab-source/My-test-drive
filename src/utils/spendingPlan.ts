// The monthly spending plan: from income, bills and savings goals, how much
// to save each month and how much can be spent per month, week and day —
// plus how the current month is tracking against it. Pure, so it can be
// tested and reused by notifications.

import { dayOfPeriod, daysIn, monthPeriod } from './period';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PlanInput {
  now: Date;
  // Income per month you set yourself (0 = estimate from history).
  monthlyIncome: number;
  // Income actually received in recent full months, newest first.
  incomeHistory: number[];
  bills: { amount: number; frequency: Frequency; interval: number }[];
  goals: { name: string; remaining: number; targetDate: string | null }[];
  // Save at least this share of income (%), even beyond goals.
  savingsPct: number;
  // Day-to-day spending (bills excluded), in the base currency.
  spentThisMonth: number;
  spentThisWeek: number;
  spentToday: number;
  weekStart: number;
  // Limits you set yourself; 0 means "use the plan's suggestion".
  limits: { daily: number; weekly: number; monthly: number };
  // The day the money month starts (default the 1st).
  monthStartDay?: number;
}

export interface Limit {
  limit: number;
  spent: number;
  left: number;
  suggested: number;
  custom: boolean;
  progress: number;
}

export interface SpendingPlan {
  income: number;
  incomeEstimated: boolean;
  bills: number;
  goalSaving: number;
  goalBreakdown: { name: string; perMonth: number; dated: boolean }[];
  saveMonthly: number;
  spendable: number;
  monthly: Limit;
  weekly: Limit;
  daily: Limit;
  daysInMonth: number;
  daysLeft: number;
  // What you'd have spent by now at an even pace.
  expectedByToday: number;
  projectedMonthEnd: number;
  status: 'on-track' | 'watch' | 'over';
}

const PER_MONTH: Record<Frequency, number> = { daily: 30.44, weekly: 4.345, monthly: 1, yearly: 1 / 12 };

export function monthlyEquivalent(amount: number, frequency: Frequency, interval = 1): number {
  return (amount * PER_MONTH[frequency]) / Math.max(1, interval);
}

function monthsUntil(target: Date, now: Date): number {
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function limitOf(custom: number, suggested: number, spent: number): Limit {
  const limit = custom > 0 ? custom : suggested;
  return { limit, spent, left: limit - spent, suggested, custom: custom > 0, progress: limit > 0 ? spent / limit : 0 };
}

export function buildSpendingPlan(p: PlanInput): SpendingPlan {
  const { now } = p;
  const history = p.incomeHistory.filter((x) => x > 0);
  const estimated = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  const income = p.monthlyIncome > 0 ? p.monthlyIncome : estimated;

  const bills = Math.round(p.bills.reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency, b.interval), 0));

  // Goals without a date are spread over a year.
  const goalBreakdown = p.goals
    .filter((g) => g.remaining > 0)
    .map((g) => {
      const target = g.targetDate ? new Date(g.targetDate) : null;
      const dated = !!target && target.getTime() > now.getTime();
      const months = dated ? monthsUntil(target!, now) : 12;
      return { name: g.name, perMonth: Math.ceil(g.remaining / months), dated };
    });
  const goalSaving = goalBreakdown.reduce((s, g) => s + g.perMonth, 0);
  const saveMonthly = Math.max(goalSaving, Math.round((income * Math.max(0, p.savingsPct)) / 100));
  const spendable = Math.max(0, income - bills - saveMonthly);

  // The money month, which may start on payday rather than the 1st.
  const period = monthPeriod(now, 0, p.monthStartDay ?? 1);
  const daysInMonth = daysIn(period);
  const day = dayOfPeriod(period, now);
  const daysLeft = daysInMonth - day + 1;

  const monthly = limitOf(p.limits.monthly, spendable, p.spentThisMonth);
  // Today's share of what's left of the month, counting from this morning.
  const leftThisMorning = monthly.limit - (p.spentThisMonth - p.spentToday);
  const dailySuggested = Math.max(0, Math.floor(leftThisMorning / daysLeft));
  const daily = limitOf(p.limits.daily, dailySuggested, p.spentToday);
  const weeklySuggested = Math.round((monthly.limit / daysInMonth) * 7);
  const weekly = limitOf(p.limits.weekly, weeklySuggested, p.spentThisWeek);

  const expectedByToday = Math.round((monthly.limit * day) / daysInMonth);
  const projectedMonthEnd = Math.round((p.spentThisMonth / day) * daysInMonth);
  const status: SpendingPlan['status'] =
    monthly.limit > 0 && p.spentThisMonth > monthly.limit ? 'over' : monthly.limit > 0 && projectedMonthEnd > monthly.limit ? 'watch' : 'on-track';

  return {
    income,
    incomeEstimated: p.monthlyIncome <= 0,
    bills,
    goalSaving,
    goalBreakdown,
    saveMonthly,
    spendable,
    monthly,
    weekly,
    daily,
    daysInMonth,
    daysLeft,
    expectedByToday,
    projectedMonthEnd,
    status,
  };
}

// Which alert, if any, a new expense triggers for a limit: once at 80% and
// once on going over, never repeating for the same period.
export function limitCrossing(before: number, after: number, limit: number): 'warn' | 'over' | null {
  if (limit <= 0) return null;
  if (before < limit && after >= limit) return 'over';
  if (before < limit * 0.8 && after >= limit * 0.8) return 'warn';
  return null;
}
