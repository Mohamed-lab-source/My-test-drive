// Gam'eya (جمعية): a savings circle where every member pays the same share
// each month and one member takes the whole pot, in turn. Pure helpers.

export interface Gameya {
  name: string;
  // Each member's monthly share, in minor units.
  share: number;
  currency: string;
  members: number;
  // The month of the first turn, 'YYYY-MM'.
  startMonth: string;
  // Your turns (1-based); some people hold two.
  myTurns: number[];
  // Who takes each turn (index 0 = turn 1); empty = not named.
  names: string[];
  // Months you've paid your share, 'YYYY-MM'.
  paid: string[];
  // Your turns' months you've received the pot.
  received: string[];
  // Day of the month the share is due.
  payDay: number;
}

export interface GameyaTurn {
  turn: number;
  month: string;
  name: string | null;
  mine: boolean;
  paid: boolean;
  received: boolean;
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function addMonthsKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function gameyaSchedule(g: Gameya): GameyaTurn[] {
  return Array.from({ length: Math.max(0, g.members) }, (_, i) => {
    const month = addMonthsKey(g.startMonth, i);
    return {
      turn: i + 1,
      month,
      name: g.names[i]?.trim() || null,
      mine: g.myTurns.includes(i + 1),
      paid: g.paid.includes(month),
      received: g.received.includes(month),
    };
  });
}

// The whole pot one turn takes.
export const gameyaPot = (g: Gameya) => g.share * g.members;

export interface GameyaStatus {
  // The turn running this month, or null before the start / after the end.
  current: GameyaTurn | null;
  finished: boolean;
  notStarted: boolean;
  paidSoFar: number;
  totalToPay: number;
  // What you'll take in total (once per turn you hold).
  toReceive: number;
  dueNow: boolean;
  // Your next turn not yet received, and how many months away it is.
  nextMine: (GameyaTurn & { monthsAway: number }) | null;
  // Months that have passed without your share being marked paid.
  unpaidPast: string[];
}

export function gameyaStatus(g: Gameya, now: Date = new Date()): GameyaStatus {
  const turns = gameyaSchedule(g);
  const today = monthKey(now);
  const offset = monthsBetween(g.startMonth, today);
  const current = offset >= 0 && offset < turns.length ? turns[offset] : null;
  const next = turns.find((t) => t.mine && !t.received && monthsBetween(today, t.month) >= 0) ?? null;
  return {
    current,
    finished: offset >= turns.length,
    notStarted: offset < 0,
    paidSoFar: g.paid.filter((m) => turns.some((t) => t.month === m)).length * g.share,
    totalToPay: turns.length * g.share,
    toReceive: g.myTurns.filter((t) => t >= 1 && t <= turns.length).length * gameyaPot(g),
    dueNow: !!current && !current.paid,
    nextMine: next ? { ...next, monthsAway: monthsBetween(today, next.month) } : null,
    unpaidPast: turns.filter((t) => monthsBetween(t.month, today) > 0 && !t.paid).map((t) => t.month),
  };
}

// Days until this month's share is due (negative once it's past).
export function daysUntilDue(g: Gameya, now: Date = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const due = new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(1, g.payDay), last));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
