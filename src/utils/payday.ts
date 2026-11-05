// The payday checklist: what to do the day your salary lands — pay the
// cards, put some aside, sadaqah, the gam'eya. Pure helpers.

export type PaydayMode = 'percent' | 'fixed' | 'cards' | 'none';

export interface PaydayStep {
  title: string;
  emoji: string;
  mode: PaydayMode;
  // A percentage of the salary, or a fixed amount in minor units.
  value: number;
  // The pay period (its start, 'YYYY-MM-DD') this step was done for.
  doneFor: string | null;
  order: number;
  // Where to go to do it.
  route: string | null;
}

export const DEFAULT_PAYDAY_STEPS: PaydayStep[] = [
  { title: 'Pay off the credit cards', emoji: '💳', mode: 'cards', value: 0, doneFor: null, order: 0, route: '/money/limits' },
  { title: 'Put savings aside', emoji: '🐷', mode: 'percent', value: 10, doneFor: null, order: 1, route: '/money/savings' },
  { title: 'Sadaqah', emoji: '🤲', mode: 'percent', value: 2.5, doneFor: null, order: 2, route: null },
  { title: "Pay the gam'eya", emoji: '🤝', mode: 'none', value: 0, doneFor: null, order: 3, route: '/money/gameya' },
  { title: 'Family support', emoji: '👨‍👩‍👧', mode: 'fixed', value: 0, doneFor: null, order: 4, route: null },
  { title: 'Pay the bills', emoji: '🧾', mode: 'none', value: 0, doneFor: null, order: 5, route: '/money/bills-calendar' },
];

export function stepAmount(step: PaydayStep, salary: number, cardsOwed: number): number {
  if (step.mode === 'percent') return Math.round((salary * step.value) / 100);
  if (step.mode === 'fixed') return step.value;
  if (step.mode === 'cards') return cardsOwed;
  return 0;
}

export const periodKey = (start: Date) =>
  `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

const SALARY = /salary|payroll|wage|راتب|مرتب/i;

// This period's salary: salary-like income since the period started, else
// the monthly income you set.
export function periodSalary(
  incomes: { amount: number; date: string; note: string | null; category: string | null }[],
  periodStart: Date,
  fallback: number
): { amount: number; found: boolean } {
  const got = incomes
    .filter((t) => new Date(t.date).getTime() >= periodStart.getTime() && SALARY.test(`${t.note ?? ''} ${t.category ?? ''}`))
    .reduce((s, t) => s + t.amount, 0);
  return got > 0 ? { amount: got, found: true } : { amount: fallback, found: false };
}
