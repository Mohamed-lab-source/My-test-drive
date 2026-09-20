import { lastNDates } from "../utils/date.js";
import { computeCurrentStreak, isVote } from "./analytics.js";
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
//# sourceMappingURL=summary.js.map