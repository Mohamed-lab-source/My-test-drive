import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecipeSummary } from "../api/types";

const STORAGE_KEY = "cookmate.mealPlan";
const RETENTION_DAYS = 14;

export type MealPlanMap = Record<string, RecipeSummary>;

type MealPlanContextValue = {
  plan: MealPlanMap;
  isLoading: boolean;
  setPlan: (dateKey: string, recipe: RecipeSummary | null) => void;
};

const MealPlanContext = createContext<MealPlanContextValue | undefined>(undefined);

function pruneOld(map: MealPlanMap): MealPlanMap {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const next: MealPlanMap = {};
  for (const [key, value] of Object.entries(map)) {
    if (key >= cutoffKey) next[key] = value;
  }
  return next;
}

export function MealPlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<MealPlanMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const pruned = pruneOld(JSON.parse(stored));
          setPlanState(pruned);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setPlan = useCallback((dateKey: string, recipe: RecipeSummary | null) => {
    setPlanState((prev) => {
      const next = { ...prev };
      if (recipe) {
        next[dateKey] = recipe;
      } else {
        delete next[dateKey];
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ plan, isLoading, setPlan }), [plan, isLoading, setPlan]);

  return <MealPlanContext.Provider value={value}>{children}</MealPlanContext.Provider>;
}

export function useMealPlan() {
  const ctx = useContext(MealPlanContext);
  if (!ctx) throw new Error("useMealPlan must be used within MealPlanProvider");
  return ctx;
}
