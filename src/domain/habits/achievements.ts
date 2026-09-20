import type { CheckIn, Habit } from './types';
import { computeLongestStreak, totalVotesAllTime } from './analytics';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  description: string;
  earned: boolean;
  /** 0..1, how close to earning — shown for locked badges. */
  progress: number;
}

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];
const VOTE_MILESTONES = [10, 50, 100, 250, 500, 1000, 2500];

export function computeBadges(habits: Habit[], checkins: CheckIn[]): Badge[] {
  const bestLongestStreak = habits.reduce((max, h) => Math.max(max, computeLongestStreak(h, checkins)), 0);
  const totalVotes = totalVotesAllTime(checkins);

  const streakBadges: Badge[] = STREAK_MILESTONES.map((m) => ({
    id: `streak-${m}`,
    icon: m >= 365 ? '🏆' : m >= 100 ? '🥇' : m >= 30 ? '🥈' : '🔥',
    label: `${m}-Day Streak`,
    description: `Keep any habit going for ${m} day${m === 1 ? '' : 's'} in a row.`,
    earned: bestLongestStreak >= m,
    progress: Math.min(1, bestLongestStreak / m),
  }));

  const voteBadges: Badge[] = VOTE_MILESTONES.map((m) => ({
    id: `votes-${m}`,
    icon: m >= 1000 ? '👑' : m >= 250 ? '⭐' : m >= 100 ? '🗳️' : '✅',
    label: `${m.toLocaleString()} Votes`,
    description: `Cast ${m.toLocaleString()} total votes for who you're becoming.`,
    earned: totalVotes >= m,
    progress: Math.min(1, totalVotes / m),
  }));

  return [...streakBadges, ...voteBadges];
}
