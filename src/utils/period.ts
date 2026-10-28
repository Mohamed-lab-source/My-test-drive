// "This month" for money, which can start on any day — e.g. the 25th when
// that's payday, so the month runs 25 Oct – 24 Nov — or on the day your
// salary actually arrives. Pure, plus one app-wide setting kept in sync from
// the settings store and your income (like the clock).

export interface MonthConfig {
  // Fixed start day (1–28); also the fallback before any payday is known.
  day: number;
  // Start each month on a detected payday instead of a fixed day.
  usePaydays: boolean;
  // Paydays as local-midnight timestamps, oldest first.
  paydays: number[];
}

let config: MonthConfig = { day: 1, usePaydays: false, paydays: [] };

export function setMonthStartDay(day: number): void {
  config = { ...config, day: Math.min(28, Math.max(1, Math.round(day) || 1)) };
}

export function getMonthStartDay(): number {
  return config.day;
}

export function setPaydayMode(usePaydays: boolean, paydays: Date[] = []): void {
  const days = [...new Set(paydays.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()))].sort((a, b) => a - b);
  config = { ...config, usePaydays, paydays: days };
}

export function getMonthConfig(): MonthConfig {
  return config;
}

export interface Period {
  // Inclusive start, exclusive end, both local midnight.
  start: Date;
  end: Date;
}

// The same day-of-month, `k` months later (clamped to the month's length).
function addMonths(d: Date, k: number): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + k + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + k, Math.min(d.getDate(), last));
}

function fixedPeriod(now: Date, offset: number, startDay: number): Period {
  const back = now.getDate() < startDay ? 1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() - back + offset, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}

// Months from payday to payday. The current one stays open until the next
// salary actually arrives, so a late salary doesn't start a new month early.
function paydayPeriod(now: Date, offset: number, cfg: MonthConfig): Period {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const p = cfg.paydays.map((t) => new Date(t));
  let i = -1;
  for (let k = 0; k < p.length; k++) if (p[k].getTime() <= today.getTime()) i = k;
  if (i < 0) return fixedPeriod(now, offset, cfg.day);
  const at = (k: number): Date => (k < 0 ? addMonths(p[0], k) : k < p.length ? p[k] : addMonths(p[p.length - 1], k - p.length + 1));
  const target = i + offset;
  const start = at(target);
  let end = at(target + 1);
  if (target === p.length - 1) {
    // No next payday yet: expected a month on, or tomorrow if it's late.
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    end = new Date(Math.max(addMonths(start, 1).getTime(), offset === 0 ? tomorrow.getTime() : 0));
  }
  return { start, end };
}

// The money month containing `now`, or `offset` months before/after it.
// Pass a day number to use a fixed start day regardless of the setting.
export function monthPeriod(now: Date = new Date(), offset = 0, startDay?: number | MonthConfig): Period {
  const cfg = typeof startDay === 'number' ? { day: startDay, usePaydays: false, paydays: [] } : (startDay ?? config);
  return cfg.usePaydays && cfg.paydays.length ? paydayPeriod(now, offset, cfg) : fixedPeriod(now, offset, cfg.day);
}

// Salary-like income → paydays: income in a Salary category or with
// "salary"/"payroll"/"راتب" in the note, at least 40% of the biggest such
// payment, and one per pay cycle (the first of any within 12 days). Days you
// marked yourself ("my salary arrived today") always count.
export function detectPaydays(
  incomes: { amount: number; date: string; note: string | null; category: string | null }[],
  manual: string[] = []
): Date[] {
  const salaryLike = incomes.filter((t) => /salary|payroll|wage|راتب|مرتب|أجر|اجر/i.test(`${t.note ?? ''} ${t.category ?? ''}`));
  const biggest = Math.max(0, ...salaryLike.map((t) => t.amount));
  const days = [
    ...salaryLike.filter((t) => t.amount >= biggest * 0.4).map((t) => new Date(t.date)),
    ...manual.map((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d);
    }),
  ]
    .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    .sort((a, b) => a.getTime() - b.getTime());
  const out: Date[] = [];
  for (const d of days) {
    if (!out.length || d.getTime() - out[out.length - 1].getTime() >= 12 * 86400000) out.push(d);
  }
  return out;
}

export function currentMonthStart(now: Date = new Date()): Date {
  return monthPeriod(now).start;
}

export function daysIn(p: Period): number {
  return Math.round((p.end.getTime() - p.start.getTime()) / 86400000);
}

// 1 on the first day of the period.
export function dayOfPeriod(p: Period, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - p.start.getTime()) / 86400000) + 1;
}

// Days left including today.
export function daysLeftIn(p: Period, now: Date = new Date()): number {
  return Math.max(1, daysIn(p) - dayOfPeriod(p, now) + 1);
}

// "October" for a calendar month, "25 Oct – 24 Nov" otherwise.
export function periodLabel(p: Period): string {
  const last = new Date(p.end.getTime() - 86400000);
  if (p.start.getDate() === 1) return p.start.toLocaleDateString(undefined, { month: 'long' });
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(p.start)} – ${fmt(last)}`;
}
