import { isVote } from "./analytics.js";
const XP_FULL = 10;
const XP_TWO_MINUTE = 5;
export function computeXP(checkins) {
    return checkins.reduce((sum, c) => {
        if (c.completedFull)
            return sum + XP_FULL;
        if (c.usedTwoMinuteVersion)
            return sum + XP_TWO_MINUTE;
        return sum;
    }, 0);
}
const TITLES = [
    "Beginner",
    "Getting Started",
    "Building Momentum",
    "Consistent",
    "Dedicated",
    "Disciplined",
    "Unstoppable",
    "Master of Habits",
];
/** Each level needs level*75 more XP than the last (a gentle, ever-lengthening curve). */
function xpRequiredForLevel(level) {
    return (level * (level + 1) * 75) / 2;
}
export function levelForXP(xp) {
    let level = 1;
    while (xpRequiredForLevel(level) <= xp)
        level++;
    const xpForThisLevel = xpRequiredForLevel(level - 1);
    const xpForNextLevel = xpRequiredForLevel(level);
    const xpIntoLevel = xp - xpForThisLevel;
    const xpSpan = xpForNextLevel - xpForThisLevel;
    return {
        level,
        title: TITLES[Math.min(TITLES.length - 1, level - 1)],
        xp,
        xpIntoLevel,
        xpForNextLevel: xpSpan,
        progress: xpSpan === 0 ? 0 : Math.min(1, xpIntoLevel / xpSpan),
    };
}
/** Derived, not stored: 1 token earned per 20 votes cast, minus tokens already spent. */
export function freezeTokenBalance(checkins) {
    const totalVotes = checkins.filter(isVote).length;
    const earned = Math.floor(totalVotes / 20);
    const used = checkins.filter((c) => c.frozen).length;
    return Math.max(0, earned - used);
}
//# sourceMappingURL=gamification.js.map