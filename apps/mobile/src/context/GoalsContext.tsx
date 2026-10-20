import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCookStreak } from "./CookStreakContext";
import { useToast } from "./ToastContext";
import { useLocale } from "../i18n/LocaleContext";
import { cookDaysInWeek, weekStartKey } from "../utils/week";

const STORAGE_KEY = "cookmate.goals";
const DEFAULT_WEEKLY_GOAL = 3;

type StoredGoals = { weeklyGoal: number; weeksHit: string[] };

type GoalsContextValue = {
  /** Days per week the user wants to cook. */
  weeklyGoal: number;
  setWeeklyGoal: (days: number) => void;
  cookDaysThisWeek: number;
  goalMetThisWeek: boolean;
  /** Week-start keys of every week the goal was reached. */
  weeksHit: string[];
};

const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const { cookLog } = useCookStreak();
  const { showToast } = useToast();
  const { t } = useLocale();
  const [goals, setGoals] = useState<StoredGoals>({ weeklyGoal: DEFAULT_WEEKLY_GOAL, weeksHit: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setGoals((prev) => ({ ...prev, ...JSON.parse(stored) }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((updater: (prev: StoredGoals) => StoredGoals) => {
    setGoals((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setWeeklyGoal = useCallback(
    (days: number) => persist((prev) => ({ ...prev, weeklyGoal: Math.max(1, Math.min(7, Math.round(days))) })),
    [persist]
  );

  const cookDaysThisWeek = cookDaysInWeek(cookLog);
  const goalMetThisWeek = cookDaysThisWeek >= goals.weeklyGoal;
  const thisWeek = weekStartKey();

  // Celebrate once per week, the moment the goal is reached.
  useEffect(() => {
    if (!loaded || !goalMetThisWeek || goals.weeksHit.includes(thisWeek)) return;
    persist((prev) => ({ ...prev, weeksHit: [...prev.weeksHit, thisWeek].slice(-104) }));
    showToast(t("goals.reachedToast", { count: goals.weeklyGoal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, goalMetThisWeek, thisWeek]);

  const value = useMemo(
    () => ({
      weeklyGoal: goals.weeklyGoal,
      setWeeklyGoal,
      cookDaysThisWeek,
      goalMetThisWeek,
      weeksHit: goals.weeksHit,
    }),
    [goals, setWeeklyGoal, cookDaysThisWeek, goalMetThisWeek]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be used within GoalsProvider");
  return ctx;
}
