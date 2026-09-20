import type { CheckIn, Habit, Weekday } from "./types.js";
import { addDays, isDue, todayISO, weekdayOf } from "../utils/date.js";

export function findCheckIn(
  checkins: CheckIn[],
  habitId: string,
  date: string
): CheckIn | undefined {
  return checkins.find((c) => c.habitId === habitId && c.date === date);
}

export function isVote(checkin: CheckIn | undefined): boolean {
  return !!checkin && (checkin.completedFull || checkin.usedTwoMinuteVersion);
}

export function isSkipped(checkin: CheckIn | undefined): boolean {
  return !!checkin && checkin.skipped;
}

export function isFrozen(checkin: CheckIn | undefined): boolean {
  return !!checkin && checkin.frozen;
}

/** Skipped or frozen — either way, neutral: doesn't count as a vote, doesn't break a streak. */
export function isNeutralized(checkin: CheckIn | undefined): boolean {
  return isSkipped(checkin) || isFrozen(checkin);
}

const MAX_LOOKBACK_DAYS = 3 * 365;

/** Current consecutive streak of votes on due days, counting back from today. */
export function computeCurrentStreak(habit: Habit, checkins: CheckIn[]): number {
  const today = todayISO();
  const createdDate = habit.createdAt.slice(0, 10);
  let streak = 0;
  let cursor = today;

  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    if (cursor < createdDate) break;
    if (isDue(habit.frequency, cursor)) {
      const checkin = findCheckIn(checkins, habit.id, cursor);
      if (isVote(checkin)) {
        streak++;
      } else if (isNeutralized(checkin)) {
        // excused or frozen — doesn't extend the streak, but doesn't break it either
      } else if (cursor === today) {
        // today not done yet doesn't break an existing streak from yesterday
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest streak ever achieved, scanning the habit's full history. */
export function computeLongestStreak(habit: Habit, checkins: CheckIn[]): number {
  const today = todayISO();
  const createdDate = habit.createdAt.slice(0, 10);
  let longest = 0;
  let current = 0;
  let cursor = createdDate;

  while (cursor <= today) {
    if (isDue(habit.frequency, cursor)) {
      const checkin = findCheckIn(checkins, habit.id, cursor);
      if (isVote(checkin)) {
        current++;
        longest = Math.max(longest, current);
      } else if (!isNeutralized(checkin)) {
        current = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }
  return longest;
}

/** Total votes cast for habits linked to an identity, within an optional set of dates. */
export function identityVoteCount(
  identityId: string,
  habits: Habit[],
  checkins: CheckIn[],
  dates?: string[]
): number {
  const habitIds = new Set(
    habits.filter((h) => h.identityId === identityId).map((h) => h.id)
  );
  const dateSet = dates ? new Set(dates) : null;
  return checkins.filter(
    (c) => habitIds.has(c.habitId) && isVote(c) && (!dateSet || dateSet.has(c.date))
  ).length;
}

/** Per-day vote counts for an identity across a list of dates, for sparklines. */
export function identityVoteSeries(
  identityId: string,
  habits: Habit[],
  checkins: CheckIn[],
  dates: string[]
): number[] {
  const habitIds = new Set(
    habits.filter((h) => h.identityId === identityId).map((h) => h.id)
  );
  return dates.map(
    (date) =>
      checkins.filter((c) => habitIds.has(c.habitId) && c.date === date && isVote(c))
        .length
  );
}

/** Fraction (0..1) of due occurrences that were completed, over the given dates. */
export function completionRate(
  habit: Habit,
  checkins: CheckIn[],
  dates: string[]
): number {
  const dueDates = dates.filter((d) => isDue(habit.frequency, d));
  if (dueDates.length === 0) return 0;
  const done = dueDates.filter((d) => isVote(findCheckIn(checkins, habit.id, d)));
  return done.length / dueDates.length;
}

/** For a heatmap: per-day fraction of due habits that were completed. */
export function dailyConsistency(
  habits: Habit[],
  checkins: CheckIn[],
  dates: string[]
): { date: string; ratio: number; due: number; done: number }[] {
  const active = habits.filter((h) => !h.archived);
  return dates.map((date) => {
    // A skipped or frozen day is left out of both sides of the ratio, so it
    // neither drags the day down nor is required to hit 100%.
    const due = active
      .filter((h) => isDue(h.frequency, date))
      .filter((h) => !isNeutralized(findCheckIn(checkins, h.id, date)));
    const done = due.filter((h) => isVote(findCheckIn(checkins, h.id, date)));
    return {
      date,
      ratio: due.length === 0 ? 0 : done.length / due.length,
      due: due.length,
      done: done.length,
    };
  });
}

export function totalVotesAllTime(checkins: CheckIn[]): number {
  return checkins.filter(isVote).length;
}

export interface WeekdayStat {
  weekday: Weekday;
  dueCount: number;
  doneCount: number;
  rate: number;
}

/** Completion rate broken down by weekday, over the habit's full history. */
export function weekdayBreakdown(habit: Habit, checkins: CheckIn[]): WeekdayStat[] {
  const today = todayISO();
  const createdDate = habit.createdAt.slice(0, 10);
  const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday: weekday as Weekday,
    dueCount: 0,
    doneCount: 0,
    rate: 0,
  }));

  let cursor = createdDate;
  while (cursor <= today) {
    if (isDue(habit.frequency, cursor)) {
      const stat = stats[weekdayOf(cursor)]!;
      stat.dueCount++;
      if (isVote(findCheckIn(checkins, habit.id, cursor))) stat.doneCount++;
    }
    cursor = addDays(cursor, 1);
  }
  for (const stat of stats) {
    stat.rate = stat.dueCount === 0 ? 0 : stat.doneCount / stat.dueCount;
  }
  return stats;
}
