import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocale } from "../i18n/LocaleContext";
import { hasReminderPermission, requestReminderPermission } from "../utils/mealReminders";
import { rescheduleLeftoverReminders } from "../utils/leftoverReminders";

const STORAGE_KEY = "cookmate.leftovers";
const REMINDERS_ENABLED_KEY = "cookmate.leftoverReminders.enabled";
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
  /** Re-inserts an exact previously-removed entry (used for "Undo remove"). */
  restoreLeftover: (entry: LeftoverEntry) => void;
  remindersEnabled: boolean;
  /** Resolves to the enabled state that actually took effect -- false if permission was denied. */
  setRemindersEnabled: (value: boolean) => Promise<boolean>;
};

const LeftoversContext = createContext<LeftoversContextValue | undefined>(undefined);

export function LeftoversProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [leftovers, setLeftovers] = useState<LeftoverEntry[]>([]);
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stored, storedReminders] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(REMINDERS_ENABLED_KEY),
        ]);
        if (stored) setLeftovers(JSON.parse(stored));
        if (storedReminders === "true") setRemindersEnabledState(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    rescheduleLeftoverReminders(leftovers, remindersEnabled, (title) => ({
      title: t("leftoverReminder.notificationTitle"),
      body: t("leftoverReminder.notificationBody", { title }),
    })).catch(() => {});
  }, [leftovers, remindersEnabled, isLoading, t]);

  const setRemindersEnabled = useCallback(async (value: boolean) => {
    if (value) {
      const granted = (await hasReminderPermission()) || (await requestReminderPermission());
      if (!granted) {
        setRemindersEnabledState(false);
        await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, "false");
        return false;
      }
    }
    setRemindersEnabledState(value);
    await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, String(value));
    return value;
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

  const restoreLeftover = useCallback(
    (entry: LeftoverEntry) => {
      persist([...leftovers, entry].sort((a, b) => a.useByDate.localeCompare(b.useByDate)));
    },
    [leftovers, persist]
  );

  const value = useMemo(
    () => ({
      isLoading,
      leftovers,
      addLeftover,
      removeLeftover,
      restoreLeftover,
      remindersEnabled,
      setRemindersEnabled,
    }),
    [isLoading, leftovers, addLeftover, removeLeftover, restoreLeftover, remindersEnabled, setRemindersEnabled]
  );

  return <LeftoversContext.Provider value={value}>{children}</LeftoversContext.Provider>;
}

export function useLeftovers() {
  const ctx = useContext(LeftoversContext);
  if (!ctx) throw new Error("useLeftovers must be used within LeftoversProvider");
  return ctx;
}
