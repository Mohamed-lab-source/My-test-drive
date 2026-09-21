import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.leftovers";
const USE_BY_DAYS = 3;

export type LeftoverEntry = {
  id: string;
  slug: string;
  title: string;
  cuisineSlug: string;
  servings: number;
  cookedDate: string; // YYYY-MM-DD
  useByDate: string; // YYYY-MM-DD
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from today to `dateKey` (negative if in the past). */
export function daysUntil(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayKey().split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((target - today) / 86400000);
}

type LeftoversContextValue = {
  isLoading: boolean;
  leftovers: LeftoverEntry[];
  addLeftover: (recipe: { slug: string; title: string; cuisineSlug: string }, servings: number) => void;
  removeLeftover: (id: string) => void;
};

const LeftoversContext = createContext<LeftoversContextValue | undefined>(undefined);

export function LeftoversProvider({ children }: { children: React.ReactNode }) {
  const [leftovers, setLeftovers] = useState<LeftoverEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setLeftovers(JSON.parse(stored));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback((next: LeftoverEntry[]) => {
    setLeftovers(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addLeftover = useCallback(
    (recipe: { slug: string; title: string; cuisineSlug: string }, servings: number) => {
      const cookedDate = todayKey();
      const entry: LeftoverEntry = {
        id: `${recipe.slug}-${cookedDate}-${Date.now()}`,
        slug: recipe.slug,
        title: recipe.title,
        cuisineSlug: recipe.cuisineSlug,
        servings,
        cookedDate,
        useByDate: addDays(cookedDate, USE_BY_DAYS),
      };
      setLeftovers((prev) => {
        const next = [...prev, entry].sort((a, b) => a.useByDate.localeCompare(b.useByDate));
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const removeLeftover = useCallback(
    (id: string) => {
      persist(leftovers.filter((entry) => entry.id !== id));
    },
    [leftovers, persist]
  );

  const value = useMemo(
    () => ({ isLoading, leftovers, addLeftover, removeLeftover }),
    [isLoading, leftovers, addLeftover, removeLeftover]
  );

  return <LeftoversContext.Provider value={value}>{children}</LeftoversContext.Provider>;
}

export function useLeftovers() {
  const ctx = useContext(LeftoversContext);
  if (!ctx) throw new Error("useLeftovers must be used within LeftoversProvider");
  return ctx;
}
