import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.recentlyRated";
const SCORES_KEY = "cookmate.myScores";
const MAX_ENTRIES = 15;

export type RecentlyRatedEntry = { slug: string; title: string; cuisineSlug: string; score: number; date: string };

type RecentlyRatedContextValue = {
  recentlyRated: RecentlyRatedEntry[];
  addRated: (entry: Omit<RecentlyRatedEntry, "date">) => void;
  /** The user's own star rating for a recipe, kept for every recipe they've rated (not just the recent 15). */
  scoreFor: (slug: string) => number | null;
  /** Records a score learnt from the server without bumping the recently-rated list. */
  rememberScore: (slug: string, score: number) => void;
};

const RecentlyRatedContext = createContext<RecentlyRatedContextValue | undefined>(undefined);

export function RecentlyRatedProvider({ children }: { children: React.ReactNode }) {
  const [recentlyRated, setRecentlyRated] = useState<RecentlyRatedEntry[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SCORES_KEY)])
      .then(([stored, storedScores]) => {
        const recent: RecentlyRatedEntry[] = stored ? JSON.parse(stored) : [];
        setRecentlyRated(recent);
        // Older installs only had the recent list; seed scores from it.
        const seeded = Object.fromEntries(recent.map((r) => [r.slug, r.score]));
        setScores({ ...seeded, ...(storedScores ? JSON.parse(storedScores) : {}) });
      })
      .catch(() => {});
  }, []);

  const rememberScore = useCallback((slug: string, score: number) => {
    setScores((prev) => {
      if (prev[slug] === score) return prev;
      const next = { ...prev, [slug]: score };
      AsyncStorage.setItem(SCORES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const scoreFor = useCallback((slug: string) => scores[slug] ?? null, [scores]);

  const addRated = useCallback((entry: Omit<RecentlyRatedEntry, "date">) => {
    setRecentlyRated((prev) => {
      const next = [
        { ...entry, date: new Date().toISOString().slice(0, 10) },
        ...prev.filter((r) => r.slug !== entry.slug),
      ].slice(0, MAX_ENTRIES);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    rememberScore(entry.slug, entry.score);
  }, [rememberScore]);

  const value = useMemo(
    () => ({ recentlyRated, addRated, scoreFor, rememberScore }),
    [recentlyRated, addRated, scoreFor, rememberScore]
  );

  return <RecentlyRatedContext.Provider value={value}>{children}</RecentlyRatedContext.Provider>;
}

export function useRecentlyRated() {
  const ctx = useContext(RecentlyRatedContext);
  if (!ctx) throw new Error("useRecentlyRated must be used within RecentlyRatedProvider");
  return ctx;
}
