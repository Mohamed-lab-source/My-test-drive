import type { CheckIn, Habit } from './types';
import { isDue, lastNDates } from './dateUtils';
import { findCheckIn, isVote } from './analytics';

export interface CorrelationInsight {
  a: Habit;
  b: Habit;
  withRate: number;
  withoutRate: number;
  sampleSize: number;
}

const WINDOW_DAYS = 60;
const MIN_SAMPLE = 7;
const MIN_SUBSET_SAMPLE = 3;
const MIN_GAP = 0.3;
const MIN_WITH_RATE = 0.6;

/**
 * Finds the strongest signal that completing habit A raises the odds of
 * completing habit B the same day, among all ordered pairs of active
 * habits — a data-driven stacking suggestion rather than a guess. Returns
 * null when nothing clears the noise threshold.
 */
export function computeCorrelationInsight(habits: Habit[], checkins: CheckIn[]): CorrelationInsight | null {
  const active = habits.filter((h) => !h.archived);
  const window = lastNDates(WINDOW_DAYS);

  let best: CorrelationInsight | null = null;

  for (const a of active) {
    for (const b of active) {
      if (a.id === b.id) continue;
      // Already stacked — the suggestion would be redundant.
      if (b.stackAnchor.type === 'habit' && b.stackAnchor.habitId === a.id) continue;

      // Bound by both habits' creation dates — a day before either existed
      // isn't a real "missed together" data point, just an absence of data.
      const earliestValid =
        a.createdAt.slice(0, 10) > b.createdAt.slice(0, 10) ? a.createdAt.slice(0, 10) : b.createdAt.slice(0, 10);
      const bothDueDates = window.filter((d) => d >= earliestValid && isDue(a.frequency, d) && isDue(b.frequency, d));
      if (bothDueDates.length < MIN_SAMPLE) continue;

      const aDoneDates = bothDueDates.filter((d) => isVote(findCheckIn(checkins, a.id, d)));
      const aNotDoneDates = bothDueDates.filter((d) => !isVote(findCheckIn(checkins, a.id, d)));
      if (aDoneDates.length < MIN_SUBSET_SAMPLE || aNotDoneDates.length < MIN_SUBSET_SAMPLE) continue;

      const withRate = aDoneDates.filter((d) => isVote(findCheckIn(checkins, b.id, d))).length / aDoneDates.length;
      const withoutRate = aNotDoneDates.filter((d) => isVote(findCheckIn(checkins, b.id, d))).length / aNotDoneDates.length;
      const gap = withRate - withoutRate;

      if (gap < MIN_GAP || withRate < MIN_WITH_RATE) continue;
      if (!best || gap > best.withRate - best.withoutRate) {
        best = { a, b, withRate, withoutRate, sampleSize: bothDueDates.length };
      }
    }
  }

  return best;
}
