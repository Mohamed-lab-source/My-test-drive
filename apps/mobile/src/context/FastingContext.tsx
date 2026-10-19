import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useLocale } from "../i18n/LocaleContext";
import type { FastRecord } from "../utils/fasting";

const STORAGE_KEY = "cookmate.fasting";
const MAX_HISTORY = 90;

export type ActiveFast = { start: number; goalHours: number; notificationId: string | null };

type FastingContextValue = {
  active: ActiveFast | null;
  history: FastRecord[];
  startFast: (goalHours: number) => void;
  /** Moves the start earlier (negative minutes) for a fast that began before tapping start. */
  adjustStart: (minutes: number) => void;
  endFast: () => FastRecord | null;
  cancelFast: () => void;
};

const FastingContext = createContext<FastingContextValue | undefined>(undefined);

function cancelNotification(id: string | null) {
  if (id) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export function FastingProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [active, setActive] = useState<ActiveFast | null>(null);
  const [history, setHistory] = useState<FastRecord[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as { active: ActiveFast | null; history: FastRecord[] };
        setActive(parsed.active ?? null);
        setHistory(parsed.history ?? []);
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((nextActive: ActiveFast | null, nextHistory: FastRecord[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ active: nextActive, history: nextHistory })).catch(() => {});
  }, []);

  /** Rings when the goal is reached, even if the app is closed. */
  const scheduleGoal = useCallback(
    async (start: number, goalHours: number): Promise<string | null> => {
      const seconds = Math.round((start + goalHours * 3600000 - Date.now()) / 1000);
      if (seconds <= 0) return null;
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted) return null;
        return await Notifications.scheduleNotificationAsync({
          content: { title: t("fasting.notificationTitle"), body: t("fasting.notificationBody", { hours: goalHours }) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
        });
      } catch {
        return null;
      }
    },
    [t]
  );

  const replaceActive = useCallback(
    (next: ActiveFast | null) => {
      setActive(next);
      persist(next, history);
      if (!next) return;
      scheduleGoal(next.start, next.goalHours).then((notificationId) => {
        if (!notificationId) return;
        setActive((cur) => {
          if (!cur || cur.start !== next.start) {
            cancelNotification(notificationId);
            return cur;
          }
          const withId = { ...cur, notificationId };
          persist(withId, history);
          return withId;
        });
      });
    },
    [history, persist, scheduleGoal]
  );

  const startFast = useCallback(
    (goalHours: number) => {
      if (active) cancelNotification(active.notificationId);
      replaceActive({ start: Date.now(), goalHours, notificationId: null });
    },
    [active, replaceActive]
  );

  const adjustStart = useCallback(
    (minutes: number) => {
      if (!active) return;
      cancelNotification(active.notificationId);
      const start = Math.min(Date.now(), active.start + minutes * 60000);
      replaceActive({ ...active, start, notificationId: null });
    },
    [active, replaceActive]
  );

  const endFast = useCallback(() => {
    if (!active) return null;
    cancelNotification(active.notificationId);
    const record: FastRecord = { start: active.start, end: Date.now(), goalHours: active.goalHours };
    const nextHistory = [record, ...history].slice(0, MAX_HISTORY);
    setActive(null);
    setHistory(nextHistory);
    persist(null, nextHistory);
    return record;
  }, [active, history, persist]);

  const cancelFast = useCallback(() => {
    if (active) cancelNotification(active.notificationId);
    setActive(null);
    persist(null, history);
  }, [active, history, persist]);

  const value = useMemo(
    () => ({ active, history, startFast, adjustStart, endFast, cancelFast }),
    [active, history, startFast, adjustStart, endFast, cancelFast]
  );

  return <FastingContext.Provider value={value}>{children}</FastingContext.Provider>;
}

export function useFasting() {
  const ctx = useContext(FastingContext);
  if (!ctx) throw new Error("useFasting must be used within FastingProvider");
  return ctx;
}
