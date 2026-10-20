export type FastRecord = { start: number; end: number; goalHours: number };

const HOUR = 3600000;

export function fastHours(f: { start: number; end: number }): number {
  return Math.max(0, (f.end - f.start) / HOUR);
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Totals plus a streak of consecutive days (by the day a fast ended) on which
 * a fast reached its goal, counting back from today or yesterday.
 */
export function fastingStats(history: FastRecord[], now = Date.now()): {
  completed: number;
  longestHours: number;
  averageHours: number;
  streakDays: number;
} {
  const done = history.filter((f) => fastHours(f) >= f.goalHours);
  const hours = history.map(fastHours);
  const days = new Set(done.map((f) => dayKey(f.end)));
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    completed: done.length,
    longestHours: Math.round(Math.max(0, ...hours) * 10) / 10,
    averageHours: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : 0,
    streakDays,
  };
}
