import type { TranslationKey } from "../i18n/translations";

export type BadgeStats = {
  totalCooked: number;
  longestStreak: number;
  cuisinesCooked: number;
  favoritesCount: number;
  collectionsCount: number;
};

export type Badge = {
  id: string;
  emoji: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  isUnlocked: (stats: BadgeStats) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: "first_cook",
    emoji: "🍳",
    titleKey: "badge.firstCook.title",
    descriptionKey: "badge.firstCook.description",
    isUnlocked: (s) => s.totalCooked >= 1,
  },
  {
    id: "cooked_10",
    emoji: "👩‍🍳",
    titleKey: "badge.cooked10.title",
    descriptionKey: "badge.cooked10.description",
    isUnlocked: (s) => s.totalCooked >= 10,
  },
  {
    id: "cooked_50",
    emoji: "🏆",
    titleKey: "badge.cooked50.title",
    descriptionKey: "badge.cooked50.description",
    isUnlocked: (s) => s.totalCooked >= 50,
  },
  {
    id: "streak_7",
    emoji: "🔥",
    titleKey: "badge.streak7.title",
    descriptionKey: "badge.streak7.description",
    isUnlocked: (s) => s.longestStreak >= 7,
  },
  {
    id: "streak_30",
    emoji: "☀️",
    titleKey: "badge.streak30.title",
    descriptionKey: "badge.streak30.description",
    isUnlocked: (s) => s.longestStreak >= 30,
  },
  {
    id: "cuisines_5",
    emoji: "🌍",
    titleKey: "badge.cuisines5.title",
    descriptionKey: "badge.cuisines5.description",
    isUnlocked: (s) => s.cuisinesCooked >= 5,
  },
  {
    id: "favorites_10",
    emoji: "❤️",
    titleKey: "badge.favorites10.title",
    descriptionKey: "badge.favorites10.description",
    isUnlocked: (s) => s.favoritesCount >= 10,
  },
  {
    id: "collector",
    emoji: "📁",
    titleKey: "badge.collector.title",
    descriptionKey: "badge.collector.description",
    isUnlocked: (s) => s.collectionsCount >= 5,
  },
];
