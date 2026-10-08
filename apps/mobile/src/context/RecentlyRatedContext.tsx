import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.recentlyRated";
const MAX_ENTRIES = 15;

export type RecentlyRatedEntry = { slug: string; title: string; cuisineSlug: string; score: number; date: string };

type RecentlyRatedContextValue = {
  recentlyRated: RecentlyRatedEntry[];
  addRated: (entry: Omit<RecentlyRatedEntry, "date">) => void;
};

const RecentlyRatedContext = createContext<RecentlyRatedContextValue | undefined>(undefined);

export function RecentlyRatedProvider({ children }: { children: React.ReactNode }) {
  const [recentlyRated, setRecentlyRated] = useState<RecentlyRatedEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setRecentlyRated(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const addRated = useCallback((entry: Omit<RecentlyRatedEntry, "date">) => {
    setRecentlyRated((prev) => {
      const next = [
        { ...entry, date: new Date().toISOString().slice(0, 10) },
        ...prev.filter((r) => r.slug !== entry.slug),
      ].slice(0, MAX_ENTRIES);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ recentlyRated, addRated }), [recentlyRated, addRated]);

  return <RecentlyRatedContext.Provider value={value}>{children}</RecentlyRatedContext.Provider>;
}

export function useRecentlyRated() {
  const ctx = useContext(RecentlyRatedContext);
  if (!ctx) throw new Error("useRecentlyRated must be used within RecentlyRatedProvider");
  return ctx;
}
