import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.homeLayout.hiddenSections";

export type HomeSectionKey = "recipeOfDay" | "browseByMealType" | "leftovers" | "recentlyViewed";

export const HOME_SECTION_KEYS: HomeSectionKey[] = [
  "recipeOfDay",
  "browseByMealType",
  "leftovers",
  "recentlyViewed",
];

type HomeLayoutContextValue = {
  isLoading: boolean;
  hiddenSections: HomeSectionKey[];
  isVisible: (key: HomeSectionKey) => boolean;
  toggleSection: (key: HomeSectionKey) => void;
};

const HomeLayoutContext = createContext<HomeLayoutContextValue | undefined>(undefined);

export function HomeLayoutProvider({ children }: { children: React.ReactNode }) {
  const [hiddenSections, setHiddenSections] = useState<HomeSectionKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setHiddenSections(JSON.parse(stored));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const toggleSection = useCallback((key: HomeSectionKey) => {
    setHiddenSections((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isVisible = useCallback((key: HomeSectionKey) => !hiddenSections.includes(key), [hiddenSections]);

  const value = useMemo(
    () => ({ isLoading, hiddenSections, isVisible, toggleSection }),
    [isLoading, hiddenSections, isVisible, toggleSection]
  );

  return <HomeLayoutContext.Provider value={value}>{children}</HomeLayoutContext.Provider>;
}

export function useHomeLayout() {
  const ctx = useContext(HomeLayoutContext);
  if (!ctx) throw new Error("useHomeLayout must be used within HomeLayoutProvider");
  return ctx;
}
