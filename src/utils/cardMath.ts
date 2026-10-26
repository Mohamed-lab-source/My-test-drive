// Figures for a credit card: what's used and available, the minimum
// payment, interest if it isn't paid in full, and how long a payment plan
// takes. Amounts are minor units; rates are percentages.

export const DEFAULT_MIN_PCT = 5;

export function minimumPayment(owed: number, minPct?: number | null): number {
  if (owed <= 0) return 0;
  return Math.min(owed, Math.ceil((owed * (minPct || DEFAULT_MIN_PCT)) / 100));
}

// Interest for one month on a balance carried over.
export function monthlyInterest(owed: number, apr?: number | null): number {
  if (owed <= 0 || !apr) return 0;
  return Math.round((owed * apr) / 1200);
}

// Months to clear `owed` paying `payment` each month, or null if the
// payment doesn't even cover the interest.
export function payoffMonths(owed: number, apr: number | null | undefined, payment: number): number | null {
  if (owed <= 0) return 0;
  if (payment <= 0) return null;
  const r = (apr || 0) / 1200;
  if (r === 0) return Math.ceil(owed / payment);
  if (payment <= owed * r) return null;
  return Math.ceil(-Math.log(1 - (r * owed) / payment) / Math.log(1 + r));
}

export function utilizationTone(u: number): 'good' | 'fair' | 'high' {
  return u < 0.3 ? 'good' : u < 0.7 ? 'fair' : 'high';
}
