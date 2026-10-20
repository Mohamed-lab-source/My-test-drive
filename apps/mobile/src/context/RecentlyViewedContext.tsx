import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecipeSummary } from "../api/types";

const STORAGE_KEY = "cookmate.recentlyViewed";
const MAX_RECENT = 10;

type RecentlyViewedContextValue = {
  recentRecipes: RecipeSummary[];
  isLoading: boolean;
  addRecent: (recipe: RecipeSummary) => void;
  removeRecent: (slug: string) => void;
  clearRecent: () => void;
};

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | undefined>(undefined);

export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
  const [recentRecipes, setRecentRecipes] = useState<RecipeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setRecentRecipes(JSON.parse(stored));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const addRecent = useCallback((recipe: RecipeSummary) => {
    setRecentRecipes((prev) => {
      const next = [recipe, ...prev.filter((r) => r.slug !== recipe.slug)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeRecent = useCallback((slug: string) => {
    setRecentRecipes((prev) => {
      const next = prev.filter((r) => r.slug !== slug);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentRecipes([]);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([])).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ recentRecipes, isLoading, addRecent, removeRecent, clearRecent }),
    [recentRecipes, isLoading, addRecent, removeRecent, clearRecent]
  );

  return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
}

export function useRecentlyViewed() {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider");
  return ctx;
}
