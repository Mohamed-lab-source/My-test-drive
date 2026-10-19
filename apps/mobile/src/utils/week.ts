/** Weeks start on Saturday, as they do in Egypt. Keys are UTC YYYY-MM-DD to match the cook log. */
export function weekStartKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceSaturday = (d.getUTCDay() + 1) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceSaturday);
  return d.toISOString().slice(0, 10);
}

/** Days cooked (unique YYYY-MM-DD keys) in the week containing `date`. */
export function cookDaysInWeek(cookLog: string[], date = new Date()): number {
  const start = weekStartKey(date);
  const [y, m, d] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  return cookLog.filter((k) => k >= start && k < end).length;
}

/** A stable number for the week, used to rotate weekly challenges. */
export function weekNumber(date = new Date()): number {
  const [y, m, d] = weekStartKey(date).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / (7 * 86400000));
}
