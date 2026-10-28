// Budget maths: which transactions a budget covers, its current period, and
// how it's doing. A budget can be daily, weekly, monthly (from your month
// start day), yearly, or a one-off date range; cover some categories,
// accounts or note keywords (or everything); and carry leftovers forward.
// Pure, so screens, alerts and tests share it.
import { monthPeriod, type Period } from './period';

export type BudgetPeriodKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface BudgetLike {
  id: string;
  category_id: string | null;
  monthly_limit: number;
  currency: string;
  name?: string | null;
  category_ids?: string | null;
  account_ids?: string | null;
  keywords?: string | null;
  period?: BudgetPeriodKind;
  start_date?: string | null;
  end_date?: string | null;
  rollover?: number;
  alert_pct?: number;
  include_bills?: number;
  is_paused?: number;
}

export interface TxLike {
  type: string;
  amount: number;
  currency: string;
  account_id: string | null;
  category_id: string | null;
  recurring_id: string | null;
  note: string | null;
  date: string;
}

export interface PeriodOptions {
  monthStartDay: number;
  // JS getDay() index the week starts on.
  weekStart: number;
}

function parseIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function budgetCategoryIds(b: BudgetLike): string[] {
  const ids = parseIds(b.category_ids);
  return ids.length ? ids : b.category_id ? [b.category_id] : [];
}

export function budgetAccountIds(b: BudgetLike): string[] {
  return parseIds(b.account_ids);
}

export function budgetKeywords(b: BudgetLike): string[] {
  return (b.keywords ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

// Does this transaction count towards the budget?
export function budgetMatches(b: BudgetLike, t: TxLike): boolean {
  if (t.type !== 'expense') return false;
  if (b.include_bills === 0 && t.recurring_id) return false;
  const cats = budgetCategoryIds(b);
  if (cats.length && (!t.category_id || !cats.includes(t.category_id))) return false;
  const accts = budgetAccountIds(b);
  if (accts.length && (!t.account_id || !accts.includes(t.account_id))) return false;
  const words = budgetKeywords(b);
  if (words.length) {
    const note = (t.note ?? '').toLowerCase();
    if (!words.some((w) => note.includes(w))) return false;
  }
  return true;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// The budget's period containing `now`, or `offset` periods before it.
// Custom budgets have just the one period.
export function budgetPeriod(b: BudgetLike, now: Date, opts: PeriodOptions, offset = 0): Period {
  const kind = b.period ?? 'monthly';
  const today = dayStart(now);
  switch (kind) {
    case 'daily': {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
    }
    case 'weekly': {
      const back = (today.getDay() - opts.weekStart + 7) % 7;
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back + offset * 7);
      return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
    }
    case 'yearly': {
      const start = new Date(today.getFullYear() + offset, 0, 1);
      return { start, end: new Date(start.getFullYear() + 1, 0, 1) };
    }
    case 'custom': {
      const start = b.start_date ? fromKey(b.start_date) : today;
      const last = b.end_date ? fromKey(b.end_date) : new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
      return { start, end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) };
    }
    default:
      return monthPeriod(now, offset, opts.monthStartDay);
  }
}

export interface BudgetStatus {
  period: Period;
  state: 'upcoming' | 'active' | 'ended';
  spent: number;
  // The limit plus anything carried over from last period (may be less).
  available: number;
  carried: number;
  left: number;
  progress: number;
  // How far through the period we are, 0–1.
  elapsed: number;
  daysLeft: number;
  perDayLeft: number;
  projected: number;
  previousSpent: number;
  pace: 'over' | 'ahead' | 'on-track' | 'under';
  // Crossed the warning % (but not over).
  warn: boolean;
}

export function budgetStatus(
  b: BudgetLike,
  txs: TxLike[],
  now: Date,
  opts: PeriodOptions,
  convert: (amount: number, currency: string) => number
): BudgetStatus {
  const period = budgetPeriod(b, now, opts);
  const spentIn = (p: Period) =>
    txs
      .filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= p.start.getTime() && ms < p.end.getTime() && budgetMatches(b, t);
      })
      .reduce((s, t) => s + convert(t.amount, t.currency), 0);

  const spent = Math.round(spentIn(period));
  const custom = (b.period ?? 'monthly') === 'custom';
  const previousSpent = custom ? 0 : Math.round(spentIn(budgetPeriod(b, now, opts, -1)));
  const carried = b.rollover && !custom ? b.monthly_limit - previousSpent : 0;
  const available = b.monthly_limit + carried;
  const left = available - spent;

  const total = period.end.getTime() - period.start.getTime();
  const t = now.getTime();
  const state = t < period.start.getTime() ? 'upcoming' : t >= period.end.getTime() ? 'ended' : 'active';
  const elapsed = state === 'upcoming' ? 0 : state === 'ended' ? 1 : (t - period.start.getTime()) / total;
  const days = Math.round(total / 86400000);
  const dayNum = state === 'active' ? Math.floor((dayStart(now).getTime() - period.start.getTime()) / 86400000) + 1 : state === 'ended' ? days : 0;
  const daysLeft = Math.max(state === 'ended' ? 0 : 1, days - dayNum + (state === 'upcoming' ? 0 : 1));
  const progress = available > 0 ? spent / available : spent > 0 ? Infinity : 0;
  const projected = state === 'active' && dayNum > 0 ? Math.round((spent / dayNum) * days) : spent;
  // A day is too short to judge pace by the clock: just near the limit or not.
  const daily = (b.period ?? 'monthly') === 'daily';
  const pace: BudgetStatus['pace'] =
    spent > available
      ? 'over'
      : daily
        ? progress >= 0.8
          ? 'ahead'
          : 'on-track'
        : progress > elapsed + 0.1
          ? 'ahead'
          : progress < elapsed - 0.25
            ? 'under'
            : 'on-track';
  const warnAt = (b.alert_pct ?? 80) / 100;

  return {
    period,
    state,
    spent,
    available,
    carried,
    left,
    progress,
    elapsed,
    daysLeft,
    perDayLeft: left > 0 && daysLeft > 0 ? Math.floor(left / daysLeft) : 0,
    projected,
    previousSpent,
    pace,
    warn: warnAt > 0 && spent <= available && progress >= warnAt,
  };
}

// The alert a new expense triggers, if it pushes spending past the warning
// % or over the limit.
export function budgetCrossing(before: number, after: number, available: number, alertPct: number): 'warn' | 'over' | null {
  if (available <= 0) return after > before ? 'over' : null;
  if (before <= available && after > available) return 'over';
  const warnAt = (available * alertPct) / 100;
  if (alertPct > 0 && before < warnAt && after >= warnAt && after <= available) return 'warn';
  return null;
}

export const PERIOD_WORD: Record<BudgetPeriodKind, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
  yearly: 'this year',
  custom: 'in total',
};
