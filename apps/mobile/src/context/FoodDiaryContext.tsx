import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { frequentFoods as pickFrequentFoods } from "../utils/diaryHelpers";

const ENTRIES_KEY = "cookmate.diary.entries";
const WATER_KEY = "cookmate.diary.water";
const TARGETS_KEY = "cookmate.diary.targets";
const RETENTION_DAYS = 90;
const FREQUENT_WINDOW_DAYS = 30;

export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD, local time
  title: string;
  slug: string | null;
  cuisineSlug: string | null;
  servings: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  createdAt: number;
};

export type NutritionTargets = {
  calories: number;
  protein: number;
  water: number;
  /** "auto" targets follow the Meal Prep calculator; editing them by hand switches to "manual". */
  source: "auto" | "manual";
};

export type DayTotals = { calories: number; protein: number; fat: number; carbs: number; count: number };

const DEFAULT_TARGETS: NutritionTargets = { calories: 2000, protein: 100, water: 8, source: "auto" };

/**
 * Local-calendar day key. Unlike the UTC keys used for meal plans, a diary
 * must count a 1am snack in Cairo (UTC+2/3) toward the day the user is
 * actually living in.
 */
export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return localDayKey(new Date(y, m - 1, d + days));
}

type AddEntryInput = Omit<DiaryEntry, "id" | "createdAt" | "date"> & { date?: string };

type FoodDiaryContextValue = {
  isLoading: boolean;
  entries: DiaryEntry[];
  targets: NutritionTargets;
  addEntry: (input: AddEntryInput) => DiaryEntry;
  removeEntry: (id: string) => void;
  restoreEntry: (entry: DiaryEntry) => void;
  entriesFor: (dayKey: string) => DiaryEntry[];
  totalsFor: (dayKey: string) => DayTotals;
  waterFor: (dayKey: string) => number;
  setWater: (dayKey: string, glasses: number) => void;
  setTargets: (patch: Partial<Omit<NutritionTargets, "source">>, source: NutritionTargets["source"]) => void;
  /** Hands targets back to the Meal Prep calculator after the user had set them by hand. */
  resetTargetsToAuto: () => void;
  /** Consecutive days with at least one entry, counting back from today (or yesterday if today is still empty). */
  loggingStreak: number;
  /** What you log most often over the last 30 days, as the latest entry of each food. */
  frequentFoods: DiaryEntry[];
  /** Copies every entry from one day onto another; returns how many were copied. */
  copyDay: (fromDay: string, toDay: string) => number;
};

const FoodDiaryContext = createContext<FoodDiaryContextValue | undefined>(undefined);

function prune(entries: DiaryEntry[]): DiaryEntry[] {
  const cutoff = shiftDayKey(localDayKey(), -RETENTION_DAYS);
  return entries.filter((e) => e.date >= cutoff);
}

export function FoodDiaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [water, setWaterState] = useState<Record<string, number>>({});
  const [targets, setTargetsState] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedEntries, storedWater, storedTargets] = await Promise.all([
          AsyncStorage.getItem(ENTRIES_KEY),
          AsyncStorage.getItem(WATER_KEY),
          AsyncStorage.getItem(TARGETS_KEY),
        ]);
        if (storedEntries) setEntries(prune(JSON.parse(storedEntries)));
        if (storedWater) setWaterState(JSON.parse(storedWater));
        if (storedTargets) setTargetsState({ ...DEFAULT_TARGETS, ...JSON.parse(storedTargets) });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistEntries = useCallback((updater: (prev: DiaryEntry[]) => DiaryEntry[]) => {
    setEntries((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addEntry = useCallback(
    (input: AddEntryInput) => {
      const entry: DiaryEntry = {
        ...input,
        date: input.date ?? localDayKey(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };
      persistEntries((prev) => prune([...prev, entry]));
      return entry;
    },
    [persistEntries]
  );

  const removeEntry = useCallback(
    (id: string) => persistEntries((prev) => prev.filter((e) => e.id !== id)),
    [persistEntries]
  );

  const restoreEntry = useCallback(
    (entry: DiaryEntry) => persistEntries((prev) => [...prev.filter((e) => e.id !== entry.id), entry]),
    [persistEntries]
  );

  const entriesFor = useCallback(
    (dayKey: string) => entries.filter((e) => e.date === dayKey).sort((a, b) => a.createdAt - b.createdAt),
    [entries]
  );

  const totalsFor = useCallback(
    (dayKey: string): DayTotals => {
      const day = entries.filter((e) => e.date === dayKey);
      return {
        calories: day.reduce((sum, e) => sum + e.calories, 0),
        protein: day.reduce((sum, e) => sum + e.protein, 0),
        fat: day.reduce((sum, e) => sum + e.fat, 0),
        // Entries saved before carbs were tracked have no field.
        carbs: day.reduce((sum, e) => sum + (e.carbs ?? 0), 0),
        count: day.length,
      };
    },
    [entries]
  );

  const waterFor = useCallback((dayKey: string) => water[dayKey] ?? 0, [water]);

  const setWater = useCallback((dayKey: string, glasses: number) => {
    setWaterState((prev) => {
      const next = { ...prev, [dayKey]: Math.max(0, Math.min(30, glasses)) };
      AsyncStorage.setItem(WATER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setTargets = useCallback(
    (patch: Partial<Omit<NutritionTargets, "source">>, source: NutritionTargets["source"]) => {
      setTargetsState((prev) => {
        // Automatic updates from the Meal Prep calculator never override targets the user set by hand.
        if (source === "auto" && prev.source === "manual") return prev;
        const next = { ...prev, ...patch, source };
        AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const resetTargetsToAuto = useCallback(() => {
    setTargetsState((prev) => {
      const next = { ...prev, source: "auto" as const };
      AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const frequentFoods = useMemo(
    () => pickFrequentFoods(entries, shiftDayKey(localDayKey(), -FREQUENT_WINDOW_DAYS)),
    [entries]
  );

  const copyDay = useCallback(
    (fromDay: string, toDay: string) => {
      const source = entries.filter((e) => e.date === fromDay);
      if (source.length === 0) return 0;
      const now = Date.now();
      const copies = source.map((e, i) => ({
        ...e,
        date: toDay,
        id: `${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now + i,
      }));
      persistEntries((prev) => prune([...prev, ...copies]));
      return copies.length;
    },
    [entries, persistEntries]
  );

  const loggingStreak = useMemo(() => {
    const days = new Set(entries.map((e) => e.date));
    let cursor = localDayKey();
    if (!days.has(cursor)) cursor = shiftDayKey(cursor, -1);
    let streak = 0;
    while (days.has(cursor)) {
      streak++;
      cursor = shiftDayKey(cursor, -1);
    }
    return streak;
  }, [entries]);

  const value = useMemo(
    () => ({
      isLoading,
      entries,
      targets,
      addEntry,
      removeEntry,
      restoreEntry,
      entriesFor,
      totalsFor,
      waterFor,
      setWater,
      setTargets,
      resetTargetsToAuto,
      loggingStreak,
      frequentFoods,
      copyDay,
    }),
    [
      isLoading,
      entries,
      targets,
      addEntry,
      removeEntry,
      restoreEntry,
      entriesFor,
      totalsFor,
      waterFor,
      setWater,
      setTargets,
      resetTargetsToAuto,
      loggingStreak,
      frequentFoods,
      copyDay,
    ]
  );

  return <FoodDiaryContext.Provider value={value}>{children}</FoodDiaryContext.Provider>;
}

export function useFoodDiary() {
  const ctx = useContext(FoodDiaryContext);
  if (!ctx) throw new Error("useFoodDiary must be used within FoodDiaryProvider");
  return ctx;
}
