import { lastNDates, todayISO, datesInRange, isDue } from "../utils/date.js";
import { computeCurrentStreak, computeLongestStreak, completionRate, isVote } from "./analytics.js";
import { computeXP, levelForXP } from "./gamification.js";
/** A short, shareable plain-text summary of recent progress. */
export function buildProgressSummary(habits, checkins) {
    const active = habits.filter((h) => !h.archived);
    const last7 = lastNDates(7);
    const votesThisWeek = checkins.filter((c) => isVote(c) && last7.includes(c.date)).length;
    const bestStreak = active.reduce((max, h) => Math.max(max, computeCurrentStreak(h, checkins)), 0);
    const level = levelForXP(computeXP(checkins));
    const lines = [
        "My Atomic habit progress:",
        `🗳️ ${votesThisWeek} vote${votesThisWeek === 1 ? "" : "s"} cast this week`,
        `🔥 ${bestStreak}-day best current streak`,
        `⭐ Level ${level.level} · ${level.title}`,
        "Every action is a vote for the person I'm becoming.",
    ];
    return lines.join("\n");
}
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const MIN_DUE_FOR_COMPARISON = 5;
/** A year-to-date recap: total votes, the strongest month, the best streak ever, and whichever habit improved most this year. */
export function computeYearInReview(habits, checkins) {
    const today = todayISO();
    const year = Number(today.slice(0, 4));
    const active = habits.filter((h) => !h.archived);
    // Grouping by the date string's own month digits avoids any Date-object
    // month-boundary arithmetic entirely — "YYYY-MM-DD" sorts and slices
    // correctly as plain strings.
    const yearVotes = checkins.filter((c) => isVote(c) && c.date.startsWith(String(year)));
    const totalVotes = yearVotes.length;
    const monthVotes = new Map();
    for (const c of yearVotes) {
        const monthIndex = Number(c.date.slice(5, 7)) - 1;
        monthVotes.set(monthIndex, (monthVotes.get(monthIndex) ?? 0) + 1);
    }
    let bestMonth = null;
    for (const [index, votes] of monthVotes) {
        if (!bestMonth || votes > bestMonth.votes)
            bestMonth = { name: MONTH_NAMES[index], votes };
    }
    const bestStreakEver = habits.reduce((max, h) => Math.max(max, computeLongestStreak(h, checkins)), 0);
    const yearStart = `${year}-01-01`;
    const midYear = `${year}-07-01`;
    const yearToDateDates = datesInRange(yearStart, today);
    const h1Dates = yearToDateDates.filter((d) => d < midYear);
    const h2Dates = yearToDateDates.filter((d) => d >= midYear);
    let mostImproved = null;
    if (h1Dates.length > 0 && h2Dates.length > 0) {
        for (const h of active) {
            const h1Due = h1Dates.filter((d) => isDue(h.frequency, d)).length;
            const h2Due = h2Dates.filter((d) => isDue(h.frequency, d)).length;
            if (h1Due < MIN_DUE_FOR_COMPARISON || h2Due < MIN_DUE_FOR_COMPARISON)
                continue;
            const before = completionRate(h, checkins, h1Dates);
            const after = completionRate(h, checkins, h2Dates);
            if (after > before && (!mostImproved || after - before > mostImproved.after - mostImproved.before)) {
                mostImproved = { habit: h, before, after };
            }
        }
    }
    return { year, totalVotes, bestMonth, bestStreakEver, mostImproved };
}
export function buildYearInReviewSummary(habits, checkins) {
    const r = computeYearInReview(habits, checkins);
    const lines = [`My ${r.year} in Atomic Habits:`, `🗳️ ${r.totalVotes} votes cast this year`];
    if (r.bestMonth)
        lines.push(`📅 Best month: ${r.bestMonth.name} (${r.bestMonth.votes} votes)`);
    lines.push(`🔥 ${r.bestStreakEver}-day longest streak`);
    if (r.mostImproved) {
        lines.push(`📈 Most improved: ${r.mostImproved.habit.name} (${Math.round(r.mostImproved.before * 100)}% → ${Math.round(r.mostImproved.after * 100)}%)`);
    }
    lines.push("Every action is a vote for the person I'm becoming.");
    return lines.join("\n");
}
//# sourceMappingURL=summary.js.map