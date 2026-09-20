// A selection of paraphrased ideas from James Clear's Atomic Habits — kept
// short and attributed, in the spirit of the book rather than verbatim text.

export interface Quote {
  text: string;
  attribution: string;
}

export const QUOTES: Quote[] = [
  { text: 'Every action is a vote for the type of person you wish to become.', attribution: 'Atomic Habits' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', attribution: 'Atomic Habits' },
  { text: 'Habits are the compound interest of self-improvement.', attribution: 'Atomic Habits' },
  { text: 'Success is the product of daily habits — not once-in-a-lifetime transformations.', attribution: 'Atomic Habits' },
  { text: "Small habits don't add up. They compound.", attribution: 'Atomic Habits' },
  { text: 'The most practical way to change who you are is to change what you do.', attribution: 'Atomic Habits' },
  { text: 'Every habit is useful for solving the type of problem you are regularly confronted with.', attribution: 'Atomic Habits' },
  { text: 'You should be far more concerned with your current trajectory than with your current results.', attribution: 'Atomic Habits' },
  { text: 'Habits are the entry point, not the end point.', attribution: 'Atomic Habits' },
  { text: 'Make it obvious. Make it attractive. Make it easy. Make it satisfying.', attribution: 'The Four Laws' },
  {
    text: 'The best way to change your habits is to focus not on what you want to achieve, but on who you wish to become.',
    attribution: 'Atomic Habits',
  },
  { text: 'Missing once is an accident. Missing twice is the start of a new habit.', attribution: 'Atomic Habits' },
];

/** Stable within a calendar day, changes each day — no persistence needed. */
export function quoteOfTheDay(): Quote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return QUOTES[dayOfYear % QUOTES.length]!;
}
