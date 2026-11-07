// Becoming debt-free: every card balance and loan in one plan. Each month
// every debt gets its minimum, and whatever is left of your monthly amount
// goes to one "focus" debt — the highest interest first (avalanche, saves
// the most) or the smallest balance first (snowball, quickest wins). When a
// debt is cleared its payment rolls into the next. Amounts in minor units.

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface PayoffDebt {
  id: string;
  name: string;
  kind: 'card' | 'loan';
  balance: number;
  // Yearly interest rate, percent (0 for a loan from family/friends).
  apr: number;
  // Card: minimum as a percent of the balance. Loan: a fixed monthly amount (0 = none).
  minPct: number;
  fixedMin: number;
}

// The smallest a card minimum goes before the balance itself (100 in your currency).
const MIN_FLOOR = 10000;

export function minimumFor(d: PayoffDebt, balance: number): number {
  if (balance <= 0) return 0;
  if (d.kind === 'card') return Math.min(balance, Math.max(MIN_FLOOR, Math.ceil((balance * (d.minPct || 5)) / 100)));
  return Math.min(balance, d.fixedMin);
}

export function payoffOrder(debts: PayoffDebt[], strategy: PayoffStrategy): PayoffDebt[] {
  return [...debts].sort((a, b) => (strategy === 'avalanche' ? b.apr - a.apr || a.balance - b.balance : a.balance - b.balance || b.apr - a.apr));
}

export interface PayoffResult {
  // False when the monthly amount can't outpace the interest.
  feasible: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  // Month each debt is cleared (1 = this coming month), and its interest.
  perDebt: Record<string, { month: number; interest: number }>;
  // What to pay on each debt this month.
  firstMonth: Record<string, number>;
  focusId: string | null;
  // The sum of this month's minimums.
  minimums: number;
}

const MAX_MONTHS = 600;

// `budget` null = only ever pay the minimums.
export function simulatePayoff(debts: PayoffDebt[], budget: number | null, strategy: PayoffStrategy): PayoffResult {
  const live = debts.filter((d) => d.balance > 0);
  const order = payoffOrder(live, strategy);
  const bal = new Map(live.map((d) => [d.id, d.balance]));
  const perDebt: PayoffResult['perDebt'] = Object.fromEntries(live.map((d) => [d.id, { month: 0, interest: 0 }]));
  const firstMonth: Record<string, number> = {};
  const minimums = live.reduce((s, d) => s + minimumFor(d, d.balance), 0);
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  let focusId: string | null = null;

  while ([...bal.values()].some((b) => b > 0) && month < MAX_MONTHS) {
    month++;
    // Interest on what's carried over.
    for (const d of order) {
      const b = bal.get(d.id)!;
      if (b <= 0 || !d.apr) continue;
      const i = Math.round((b * d.apr) / 1200);
      bal.set(d.id, b + i);
      perDebt[d.id].interest += i;
      totalInterest += i;
    }
    const pays = new Map<string, number>();
    let left = budget == null ? Infinity : budget;
    for (const d of order) {
      const b = bal.get(d.id)!;
      const m = Math.min(minimumFor(d, b), left);
      if (m > 0) {
        pays.set(d.id, m);
        left -= m;
      }
    }
    if (budget != null) {
      for (const d of order) {
        if (left <= 0) break;
        const b = bal.get(d.id)! - (pays.get(d.id) ?? 0);
        if (b <= 0) continue;
        const extra = Math.min(b, left);
        pays.set(d.id, (pays.get(d.id) ?? 0) + extra);
        left -= extra;
        if (month === 1 && !focusId) focusId = d.id;
      }
    }
    let paidThisMonth = 0;
    for (const [id, p] of pays) {
      const nb = bal.get(id)! - p;
      bal.set(id, Math.max(0, nb));
      paidThisMonth += p;
      if (month === 1) firstMonth[id] = p;
      if (nb <= 0 && !perDebt[id].month) perDebt[id].month = month;
    }
    totalPaid += paidThisMonth;
    // Nothing paid at all: it would never end.
    if (paidThisMonth <= 0) break;
  }
  const done = [...bal.values()].every((b) => b <= 0);
  return { feasible: done, months: done ? month : MAX_MONTHS, totalInterest, totalPaid, perDebt, firstMonth, focusId, minimums };
}

// A month number from now as a date (the 1st of that month).
export function monthFromNow(now: Date, months: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + months, 1);
}
