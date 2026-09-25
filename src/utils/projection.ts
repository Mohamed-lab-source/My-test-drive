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
