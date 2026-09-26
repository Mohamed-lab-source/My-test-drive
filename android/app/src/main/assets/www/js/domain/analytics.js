import { addDays, isDue, todayISO, weekdayOf } from "../utils/date.js";
// findCheckIn is called very heavily — once per (habit, date) pair, often in
// nested loops across streaks/consistency/correlation — so a linear .find()
// rescan of the whole array on every call gets expensive as history grows.
// Keyed by array *reference*, so it stays correct: a new checkins array
// (which the store always produces on mutation) simply builds a fresh index,
// while repeated calls within the same render pass reuse the one already built.
const checkinIndexCache = new WeakMap();
function getCheckinIndex(checkins) {
    let index = checkinIndexCache.get(checkins);
    if (!index) {
        index = new Map();
        for (const c of checkins)
            index.set(`${c.habitId}|${c.date}`, c);
        checkinIndexCache.set(checkins, index);
    }
    return index;
}
export function findCheckIn(checkins, habitId, date) {
    return getCheckinIndex(checkins).get(`${habitId}|${date}`);
}
// Same idea for habit-by-id lookups: views re-resolve a habit from the
// latest `habits` array on every render (the store always hands back a
// fresh array on mutation), so a linear .find() rescan repeats needlessly
// across a render pass. Keyed by array reference for the same reason —
// correctness for free on any real mutation, reuse within one pass.
const habitIndexCache = new WeakMap();
function getHabitIndex(habits) {
    let index = habitIndexCache.get(habits);
    if (!index) {
        index = new Map();
        for (const h of habits)
            index.set(h.id, h);
        habitIndexCache.set(habits, index);
    }
    return index;
}
export function findHabitById(habits, id) {
    return getHabitIndex(habits).get(id);
}
export function isVote(checkin) {
    return !!checkin && (checkin.completedFull || checkin.usedTwoMinuteVersion);
}
export function isSkipped(checkin) {
    return !!checkin && checkin.skipped;
}
export function isFrozen(checkin) {
    return !!checkin && checkin.frozen;
}
/** Skipped or frozen — either way, neutral: doesn't count as a vote, doesn't break a streak. */
export function isNeutralized(checkin) {
    return isSkipped(checkin) || isFrozen(checkin);
}
const MAX_LOOKBACK_DAYS = 3 * 365;
/** Current consecutive streak of votes on due days, counting back from today. */
export function computeCurrentStreak(habit, checkins) {
    const today = todayISO();
    const createdDate = habit.createdAt.slice(0, 10);
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
        if (cursor < createdDate)
            break;
        if (isDue(habit.frequency, cursor)) {
            const checkin = findCheckIn(checkins, habit.id, cursor);
            if (isVote(checkin)) {
                streak++;
            }
            else if (isNeutralized(checkin)) {
                // excused or frozen — doesn't extend the streak, but doesn't break it either
            }
            else if (cursor === today) {
                // today not done yet doesn't break an existing streak from yesterday
            }
            else {
                break;
            }
        }
        cursor = addDays(cursor, -1);
    }
    return streak;
}
/** Longest streak ever achieved, scanning the habit's full history. */
export function computeLongestStreak(habit, checkins) {
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
            }
            else if (!isNeutralized(checkin)) {
                current = 0;
            }
        }
        cursor = addDays(cursor, 1);
    }
    return longest;
}
/** Total votes cast for habits linked to an identity, within an optional set of dates. */
export function identityVoteCount(identityId, habits, checkins, dates) {
    const habitIds = new Set(habits.filter((h) => h.identityId === identityId).map((h) => h.id));
    const dateSet = dates ? new Set(dates) : null;
    return checkins.filter((c) => habitIds.has(c.habitId) && isVote(c) && (!dateSet || dateSet.has(c.date))).length;
}
/** Per-day vote counts for an identity across a list of dates, for sparklines. */
export function identityVoteSeries(identityId, habits, checkins, dates) {
    const habitIds = new Set(habits.filter((h) => h.identityId === identityId).map((h) => h.id));
    return dates.map((date) => checkins.filter((c) => habitIds.has(c.habitId) && c.date === date && isVote(c))
        .length);
}
/** Fraction (0..1) of due occurrences that were completed, over the given dates. */
export function completionRate(habit, checkins, dates) {
    const dueDates = dates.filter((d) => isDue(habit.frequency, d));
    if (dueDates.length === 0)
        return 0;
    const done = dueDates.filter((d) => isVote(findCheckIn(checkins, habit.id, d)));
    return done.length / dueDates.length;
}
/** For a heatmap: per-day fraction of due habits that were completed. */
export function dailyConsistency(habits, checkins, dates) {
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
export function totalVotesAllTime(checkins) {
    return checkins.filter(isVote).length;
}
/** Completion rate broken down by weekday, over the habit's full history. */
export function weekdayBreakdown(habit, checkins) {
    const today = todayISO();
    const createdDate = habit.createdAt.slice(0, 10);
    const stats = Array.from({ length: 7 }, (_, weekday) => ({
        weekday: weekday,
        dueCount: 0,
        doneCount: 0,
        rate: 0,
    }));
    let cursor = createdDate;
    while (cursor <= today) {
        if (isDue(habit.frequency, cursor)) {
            const stat = stats[weekdayOf(cursor)];
            stat.dueCount++;
            if (isVote(findCheckIn(checkins, habit.id, cursor)))
                stat.doneCount++;
        }
        cursor = addDays(cursor, 1);
    }
    for (const stat of stats) {
        stat.rate = stat.dueCount === 0 ? 0 : stat.doneCount / stat.dueCount;
    }
    return stats;
}
//# sourceMappingURL=analytics.js.map