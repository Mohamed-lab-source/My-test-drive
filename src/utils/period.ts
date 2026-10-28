// "This month" for money, which can start on any day — e.g. the 25th when
// that's payday, so the month runs 25 Oct – 24 Nov. Pure, plus one
// app-wide setting kept in sync from the settings store (like the clock).

let monthStartDay = 1;

export function setMonthStartDay(day: number): void {
  monthStartDay = Math.min(28, Math.max(1, Math.round(day) || 1));
}

export function getMonthStartDay(): number {
  return monthStartDay;
}

export interface Period {
  // Inclusive start, exclusive end, both local midnight.
  start: Date;
  end: Date;
}

// The money month containing `now`, or `offset` months before/after it.
export function monthPeriod(now: Date = new Date(), offset = 0, startDay: number = monthStartDay): Period {
  const back = now.getDate() < startDay ? 1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() - back + offset, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
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
