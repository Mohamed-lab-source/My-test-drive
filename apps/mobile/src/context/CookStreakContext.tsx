import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.cookStreak";

type StreakState = {
  currentStreak: number;
  longestStreak: number;
  totalCooked: number;
  lastCookedDate: string | null; // YYYY-MM-DD
};

const DEFAULT_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  totalCooked: 0,
  lastCookedDate: null,
};

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
  /** Records today's cook, updating the streak. Safe to call more than once in a day. Returns the resulting streak length. */
  recordCooked: () => number;
};

const CookStreakContext = createContext<CookStreakContextValue | undefined>(undefined);

export function CookStreakProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StreakState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setState({ ...DEFAULT_STATE, ...JSON.parse(stored) });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const recordCooked = useCallback(() => {
    const today = todayKey();
    let resultStreak = state.currentStreak;
    setState((prev) => {
      if (prev.lastCookedDate === today) {
        resultStreak = prev.currentStreak;
        return prev;
      }
      const gap = prev.lastCookedDate ? daysBetween(prev.lastCookedDate, today) : null;
      const nextStreak = gap === 1 ? prev.currentStreak + 1 : 1;
      const next: StreakState = {
        currentStreak: nextStreak,
        longestStreak: Math.max(prev.longestStreak, nextStreak),
        totalCooked: prev.totalCooked + 1,
        lastCookedDate: today,
      };
      resultStreak = nextStreak;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return resultStreak;
  }, [state.currentStreak]);

  const today = todayKey();
  const gapFromToday = state.lastCookedDate ? daysBetween(state.lastCookedDate, today) : null;
  const displayStreak = gapFromToday === null || gapFromToday > 1 ? 0 : state.currentStreak;
  const cookedToday = state.lastCookedDate === today;

  const value = useMemo(
    () => ({
      isLoading,
      displayStreak,
      longestStreak: state.longestStreak,
      totalCooked: state.totalCooked,
      cookedToday,
      recordCooked,
    }),
    [isLoading, displayStreak, state.longestStreak, state.totalCooked, cookedToday, recordCooked]
  );

  return <CookStreakContext.Provider value={value}>{children}</CookStreakContext.Provider>;
}

export function useCookStreak() {
  const ctx = useContext(CookStreakContext);
  if (!ctx) throw new Error("useCookStreak must be used within CookStreakProvider");
  return ctx;
}
