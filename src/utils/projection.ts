// Estimates a completion date from a payment/contribution history's pace.
// Needs at least 2 data points to have a meaningful rate — one payment
// alone has no time span to compute a pace from.
export function estimatePaceCompletionDate(
  remaining: number,
  history: Array<{ amount: number; date: string }>
): string | null {
  if (remaining <= 0 || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const total = sorted.reduce((sum, h) => sum + h.amount, 0);
  const daysSpan = Math.max(
    1,
    (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) / 86400000
  );
  const perDay = total / daysSpan;
  if (perDay <= 0) return null;
  const daysNeeded = Math.ceil(remaining / perDay);
  const result = new Date();
  result.setDate(result.getDate() + daysNeeded);
  return result.toISOString();
}

// How much to put aside each month to hit `remaining` by `targetDate`.
// Returns null once the date has passed (or if nothing is left to save).
export function monthlyAmountNeeded(remaining: number, targetDate: string, now: Date = new Date()): number | null {
  const target = new Date(targetDate);
  if (remaining <= 0 || target.getTime() <= now.getTime()) return null;
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.ceil(remaining / Math.max(1, months));
}

// ISO date at local noon `days` from today — noon keeps the calendar day
// stable across time-zone shifts.
export function isoDaysFromNow(days: number, now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12).toISOString();
}
