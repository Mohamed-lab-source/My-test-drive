import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.cookStreak";

const COOK_LOG_MAX_DAYS = 90;
const RECENTLY_COOKED_MAX = 15;

export type CookedRecipeRef = { slug: string; title: string; cuisineSlug: string };
export type RecentlyCookedEntry = CookedRecipeRef & { date: string };

type StreakState = {
  currentStreak: number;
  longestStreak: number;
  totalCooked: number;
  lastCookedDate: string | null; // YYYY-MM-DD
  cookCounts: Record<string, number>;
  /** Unique YYYY-MM-DD days cooked, ascending, capped to the last COOK_LOG_MAX_DAYS entries. */
  cookLog: string[];
  /** Most-recently-cooked recipes, most recent first, deduped by slug, capped to RECENTLY_COOKED_MAX. */
  recentlyCooked: RecentlyCookedEntry[];
  /** Unique cuisine slugs ever cooked, unordered -- used for the "tried N cuisines" badge. */
  cuisinesCooked: string[];
  /** Last YYYY-MM-DD each recipe was cooked, uncapped (unlike recentlyCooked). */
  lastCooked: Record<string, string>;
  /** The missed day a streak freeze last covered; one freeze is available per 7 days. */
  freezeUsedOn: string | null;
};

const FREEZE_COOLDOWN_DAYS = 7;

const DEFAULT_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  totalCooked: 0,
  lastCookedDate: null,
  cookCounts: {},
  cookLog: [],
  recentlyCooked: [],
  cuisinesCooked: [],
  lastCooked: {},
  freezeUsedOn: null,
};

function freezeAvailableOn(freezeUsedOn: string | null, day: string): boolean {
  return freezeUsedOn === null || daysBetween(freezeUsedOn, day) >= FREEZE_COOLDOWN_DAYS;
}

function shiftKey(day: string, offset: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD keys (positive when `to` is later). */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUTC = Date.UTC(fy, fm - 1, fd);
  const toUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((toUTC - fromUTC) / 86400000);
}

type CookStreakContextValue = {
  isLoading: boolean;
  /** Current streak as of today -- 0 if the last cooked day was before yesterday (streak lapsed but not yet reset in storage). */
  displayStreak: number;
  longestStreak: number;
  totalCooked: number;
  cookedToday: boolean;
  /** A streak freeze is ready to cover one missed day (one per week). */
  freezeAvailable: boolean;
  /** Yesterday was missed and the freeze is holding the streak until you cook today. */
  freezeProtecting: boolean;
  /** Records today's cook, updating the streak and the per-recipe cook count. Safe to call more than once in a day. Returns the resulting streak length. */
  recordCooked: (recipe: CookedRecipeRef) => number;
  cookCountFor: (slug: string) => number;
  /** YYYY-MM-DD (UTC) of the last time this recipe was cooked, or null. */
  lastCookedFor: (slug: string) => string | null;
  cookCounts: Record<string, number>;
  cookLog: string[];
  recentlyCooked: RecentlyCookedEntry[];
  cuisinesCooked: string[];
};

const CookStreakContext = createContext<CookStreakContextValue | undefined>(undefined);

export function CookStreakProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StreakState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = { ...DEFAULT_STATE, ...JSON.parse(stored) } as StreakState;
          // Saves from before lastCooked existed: seed it from the recently-cooked list.
          if (Object.keys(parsed.lastCooked).length === 0) {
            parsed.lastCooked = Object.fromEntries(parsed.recentlyCooked.map((r) => [r.slug, r.date]));
          }
          setState(parsed);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const recordCooked = useCallback((recipe: CookedRecipeRef) => {
    const today = todayKey();
    let resultStreak = state.currentStreak;
    setState((prev) => {
      const nextCookCounts = { ...prev.cookCounts, [recipe.slug]: (prev.cookCounts[recipe.slug] ?? 0) + 1 };
      const nextCookLog = prev.cookLog.includes(today)
        ? prev.cookLog
        : [...prev.cookLog, today].slice(-COOK_LOG_MAX_DAYS);
      const nextRecentlyCooked = [
        { ...recipe, date: today },
        ...prev.recentlyCooked.filter((r) => r.slug !== recipe.slug),
      ].slice(0, RECENTLY_COOKED_MAX);
      const nextCuisinesCooked = prev.cuisinesCooked.includes(recipe.cuisineSlug)
        ? prev.cuisinesCooked
        : [...prev.cuisinesCooked, recipe.cuisineSlug];
      const nextLastCooked = { ...prev.lastCooked, [recipe.slug]: today };
      if (prev.lastCookedDate === today) {
        resultStreak = prev.currentStreak;
        const next: StreakState = {
          ...prev,
          cookCounts: nextCookCounts,
          cookLog: nextCookLog,
          recentlyCooked: nextRecentlyCooked,
          cuisinesCooked: nextCuisinesCooked,
          lastCooked: nextLastCooked,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }
      const gap = prev.lastCookedDate ? daysBetween(prev.lastCookedDate, today) : null;
      // Missing exactly one day spends the weekly streak freeze instead of resetting.
      const useFreeze = gap === 2 && prev.currentStreak > 0 && freezeAvailableOn(prev.freezeUsedOn, today);
      const nextStreak = gap === 1 || useFreeze ? prev.currentStreak + 1 : 1;
      const next: StreakState = {
        currentStreak: nextStreak,
        longestStreak: Math.max(prev.longestStreak, nextStreak),
        totalCooked: prev.totalCooked + 1,
        lastCookedDate: today,
        cookCounts: nextCookCounts,
        cookLog: nextCookLog,
        recentlyCooked: nextRecentlyCooked,
        cuisinesCooked: nextCuisinesCooked,
        lastCooked: nextLastCooked,
        freezeUsedOn: useFreeze ? shiftKey(today, -1) : prev.freezeUsedOn,
      };
      resultStreak = nextStreak;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return resultStreak;
  }, [state.currentStreak]);

  const cookCountFor = useCallback((slug: string) => state.cookCounts[slug] ?? 0, [state.cookCounts]);
  const lastCookedFor = useCallback((slug: string) => state.lastCooked[slug] ?? null, [state.lastCooked]);

  const today = todayKey();
  const gapFromToday = state.lastCookedDate ? daysBetween(state.lastCookedDate, today) : null;
  const freezeAvailable = freezeAvailableOn(state.freezeUsedOn, today);
  // Yesterday was missed but the freeze will cover it if you cook today.
  const freezeProtecting = gapFromToday === 2 && state.currentStreak > 0 && freezeAvailable;
  const displayStreak =
    gapFromToday === null || (gapFromToday > 1 && !freezeProtecting) ? 0 : state.currentStreak;
  const cookedToday = state.lastCookedDate === today;

  const value = useMemo(
    () => ({
      isLoading,
      displayStreak,
      longestStreak: state.longestStreak,
      totalCooked: state.totalCooked,
      cookedToday,
      freezeAvailable,
      freezeProtecting,
      recordCooked,
      cookCountFor,
      lastCookedFor,
      cookCounts: state.cookCounts,
      cookLog: state.cookLog,
      recentlyCooked: state.recentlyCooked,
      cuisinesCooked: state.cuisinesCooked,
    }),
    [
      isLoading,
      displayStreak,
      state.longestStreak,
      state.totalCooked,
      state.cookCounts,
      state.cookLog,
      state.recentlyCooked,
      state.cuisinesCooked,
      cookedToday,
      freezeAvailable,
      freezeProtecting,
      recordCooked,
      cookCountFor,
      lastCookedFor,
    ]
  );

  return <CookStreakContext.Provider value={value}>{children}</CookStreakContext.Provider>;
}

export function useCookStreak() {
  const ctx = useContext(CookStreakContext);
  if (!ctx) throw new Error("useCookStreak must be used within CookStreakProvider");
  return ctx;
}
