// A rotating pool of small, generic nudges in the spirit of Atomic Habits —
// variety on top of the core habit loop, not tied to any specific habit.

export interface Challenge {
  icon: string;
  text: string;
}

export const CHALLENGES: Challenge[] = [
  { icon: '⏱️', text: 'Do the 2-minute version of your hardest habit first today.' },
  { icon: '🔗', text: 'Notice one habit you already do well — what cue triggers it? Reuse that cue elsewhere.' },
  { icon: '🧠', text: "Before your next habit, say out loud: 'I am the type of person who...'" },
  { icon: '🎯', text: 'Pick your easiest habit and do it a little better than usual today.' },
  { icon: '🧹', text: "Remove one small friction point in your environment for a habit you're building." },
  { icon: '📝', text: 'Write one sentence about why today\'s effort matters to future-you.' },
  { icon: '🤝', text: "Tell someone what you're working on today — accountability compounds." },
  { icon: '🐢', text: 'Go slower than you think you need to on one habit. Consistency beats intensity.' },
  { icon: '🔁', text: 'Do a habit at the exact same time you did it yesterday — same cue, same time.' },
  { icon: '🌤️', text: "If yesterday was rough, aim for 'never miss twice' today." },
];

/** Stable within a calendar day, changes each day — no persistence needed. */
export function challengeOfTheDay(): Challenge {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  // Offset from quoteOfTheDay's index so the two cards don't feel synced.
  const dayOfYear = Math.floor(diff / 86400000) + 5;
  return CHALLENGES[dayOfYear % CHALLENGES.length]!;
}
