import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BADGES, type Badge, type BadgeStats } from "../data/badges";
import { useCookStreak } from "./CookStreakContext";
import { useFavorites } from "./FavoritesContext";
import { useCollections } from "./CollectionsContext";
import { useToast } from "./ToastContext";
import { useCookingJournal } from "./CookingJournalContext";
import { useFoodDiary } from "./FoodDiaryContext";
import { useHousehold } from "./HouseholdContext";
import { usePantryCheck } from "./PantryCheckContext";
import { useGoals } from "./GoalsContext";
import { useLocale } from "../i18n/LocaleContext";

const SEEN_BADGES_KEY = "cookmate.seenBadges";

type BadgeWithState = Badge & { unlocked: boolean };

type BadgesContextValue = {
  badges: BadgeWithState[];
  unlockedCount: number;
};

const BadgesContext = createContext<BadgesContextValue | undefined>(undefined);

export function BadgesProvider({ children }: { children: React.ReactNode }) {
  const { totalCooked, longestStreak, cuisinesCooked } = useCookStreak();
  const { favoriteRecipes } = useFavorites();
  const { collections } = useCollections();
  const { entries: journalEntries } = useCookingJournal();
  const { loggingStreak } = useFoodDiary();
  const { members } = useHousehold();
  const { items: pantryItems } = usePantryCheck();
  const { weeksHit } = useGoals();
  const journalNotes = journalEntries.filter((e) => e.note.trim().length > 0).length;
  const { showToast } = useToast();
  const { t } = useLocale();
  const seenRef = useRef<Set<string> | null>(null);

  const stats: BadgeStats = useMemo(
    () => ({
      totalCooked,
      longestStreak,
      cuisinesCooked: cuisinesCooked.length,
      favoritesCount: favoriteRecipes.length,
      collectionsCount: collections.length,
      journalNotes,
      diaryStreak: loggingStreak,
      householdSize: members.length,
      pantryCount: pantryItems.length,
      goalWeeks: weeksHit.length,
    }),
    [
      totalCooked,
      longestStreak,
      cuisinesCooked.length,
      favoriteRecipes.length,
      collections.length,
      journalNotes,
      loggingStreak,
      members.length,
      pantryItems.length,
      weeksHit.length,
    ]
  );

  const badges = useMemo<BadgeWithState[]>(
    () => BADGES.map((b) => ({ ...b, unlocked: b.isUnlocked(stats) })),
    [stats]
  );

  useEffect(() => {
    AsyncStorage.getItem(SEEN_BADGES_KEY)
      .then((stored) => {
        seenRef.current = new Set(stored ? (JSON.parse(stored) as string[]) : []);
      })
      .catch(() => {
        seenRef.current = new Set();
      });
  }, []);

  useEffect(() => {
    if (!seenRef.current) return;
    const newlyUnlocked = badges.filter((b) => b.unlocked && !seenRef.current!.has(b.id));
    if (newlyUnlocked.length === 0) return;
    for (const badge of newlyUnlocked) {
      seenRef.current.add(badge.id);
      showToast(t("badge.unlockedToast", { emoji: badge.emoji, title: t(badge.titleKey) }));
    }
    AsyncStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(Array.from(seenRef.current))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges]);

  const value = useMemo(
    () => ({ badges, unlockedCount: badges.filter((b) => b.unlocked).length }),
    [badges]
  );

  return <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>;
}

export function useBadges() {
  const ctx = useContext(BadgesContext);
  if (!ctx) throw new Error("useBadges must be used within BadgesProvider");
  return ctx;
}
