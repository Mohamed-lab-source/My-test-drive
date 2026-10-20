import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useAccessibilityPrefs } from "./AccessibilityPrefsContext";
import { useLocale } from "../i18n/LocaleContext";

const STORAGE_KEY = "cookmate.kitchenTimers";
const MAX_TIMERS = 8;

export type KitchenTimer = {
  id: string;
  label: string;
  durationSec: number;
  /** Epoch ms when a running timer ends; null while paused or done. */
  endsAt: number | null;
  /** Seconds left, kept up to date while paused (running timers derive it from endsAt). */
  pausedRemainingSec: number;
  done: boolean;
  notificationId: string | null;
  /** Optional tag so Cook Mode can find "the timer for step 3". */
  tag?: string;
};

type KitchenTimersContextValue = {
  timers: KitchenTimer[];
  /** Ticks every second while any timer runs; use it to render countdowns. */
  now: number;
  remainingSec: (timer: KitchenTimer) => number;
  start: (label: string, minutes: number, tag?: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  addMinute: (id: string) => void;
  dismiss: (id: string) => void;
  /** The most recent timer to finish, so screens can react (e.g. read it aloud). */
  lastFinished: { id: string; label: string; at: number } | null;
};

const KitchenTimersContext = createContext<KitchenTimersContextValue | undefined>(undefined);

async function scheduleDone(label: string, seconds: number, title: string): Promise<string | null> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body: label },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)) },
    });
  } catch {
    return null;
  }
}

function cancel(notificationId: string | null) {
  if (notificationId) Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/**
 * Timers live above every screen so they keep counting when you leave Cook
 * Mode, and each one also schedules a local notification so it still rings
 * if the phone is locked or the app is in the background.
 */
export function KitchenTimersProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const { hapticsEnabled } = useAccessibilityPrefs();
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastFinished, setLastFinished] = useState<KitchenTimersContextValue["lastFinished"]>(null);
  const hapticsRef = useRef(hapticsEnabled);
  hapticsRef.current = hapticsEnabled;
  const titleRef = useRef(t("timers.notificationTitle"));
  titleRef.current = t("timers.notificationTitle");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setTimers(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: KitchenTimer[]) => KitchenTimer[]) => {
    setTimers((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const anyRunning = timers.some((tm) => tm.endsAt != null);

  // One shared ticker, only while something is counting down.
  useEffect(() => {
    if (!anyRunning) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [anyRunning]);

  // Mark finished timers as done once (the scheduled notification covers the background case).
  useEffect(() => {
    const finished = timers.filter((tm) => tm.endsAt != null && tm.endsAt <= now && !tm.done);
    if (finished.length === 0) return;
    update((prev) =>
      prev.map((tm) =>
        finished.some((f) => f.id === tm.id) ? { ...tm, endsAt: null, pausedRemainingSec: 0, done: true } : tm
      )
    );
    const last = finished[finished.length - 1];
    setLastFinished({ id: last.id, label: last.label, at: now });
    if (hapticsRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 400);
    }
  }, [now, timers, update]);

  const remainingSec = useCallback(
    (timer: KitchenTimer) =>
      timer.done ? 0 : timer.endsAt != null ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : timer.pausedRemainingSec,
    [now]
  );

  const attachNotification = useCallback(
    (id: string, label: string, seconds: number) => {
      scheduleDone(label, seconds, titleRef.current).then((notificationId) => {
        if (!notificationId) return;
        update((prev) => prev.map((tm) => (tm.id === id ? { ...tm, notificationId } : tm)));
      });
    },
    [update]
  );

  const start = useCallback(
    (label: string, minutes: number, tag?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const durationSec = Math.round(minutes * 60);
      const startedAt = Date.now();
      setNow(startedAt);
      update((prev) => {
        // Restarting a tagged timer (e.g. the same step) replaces the old one.
        const kept = prev.filter((tm) => {
          if (tag && tm.tag === tag) {
            cancel(tm.notificationId);
            return false;
          }
          return true;
        });
        const timer: KitchenTimer = {
          id,
          label,
          durationSec,
          endsAt: startedAt + durationSec * 1000,
          pausedRemainingSec: durationSec,
          done: false,
          notificationId: null,
          tag,
        };
        return [...kept, timer].slice(-MAX_TIMERS);
      });
      attachNotification(id, label, durationSec);
    },
    [update, attachNotification]
  );

  const pause = useCallback(
    (id: string) =>
      update((prev) =>
        prev.map((tm) => {
          if (tm.id !== id || tm.endsAt == null) return tm;
          cancel(tm.notificationId);
          return {
            ...tm,
            endsAt: null,
            pausedRemainingSec: Math.max(0, Math.ceil((tm.endsAt - Date.now()) / 1000)),
            notificationId: null,
          };
        })
      ),
    [update]
  );

  const resume = useCallback(
    (id: string) => {
      const timer = timers.find((tm) => tm.id === id);
      if (!timer || timer.endsAt != null || timer.done) return;
      const startedAt = Date.now();
      setNow(startedAt);
      update((prev) =>
        prev.map((tm) => (tm.id === id ? { ...tm, endsAt: startedAt + tm.pausedRemainingSec * 1000 } : tm))
      );
      attachNotification(id, timer.label, timer.pausedRemainingSec);
    },
    [timers, update, attachNotification]
  );

  const addMinute = useCallback(
    (id: string) => {
      const timer = timers.find((tm) => tm.id === id);
      if (!timer) return;
      cancel(timer.notificationId);
      const base = Date.now();
      const remaining = timer.done ? 0 : timer.endsAt != null ? Math.max(0, (timer.endsAt - base) / 1000) : timer.pausedRemainingSec;
      const nextRemaining = remaining + 60;
      setNow(base);
      update((prev) =>
        prev.map((tm) =>
          tm.id === id
            ? { ...tm, done: false, endsAt: base + nextRemaining * 1000, pausedRemainingSec: nextRemaining, notificationId: null }
            : tm
        )
      );
      attachNotification(id, timer.label, nextRemaining);
    },
    [timers, update, attachNotification]
  );

  const dismiss = useCallback(
    (id: string) =>
      update((prev) =>
        prev.filter((tm) => {
          if (tm.id === id) cancel(tm.notificationId);
          return tm.id !== id;
        })
      ),
    [update]
  );

  const value = useMemo(
    () => ({ timers, now, remainingSec, start, pause, resume, addMinute, dismiss, lastFinished }),
    [timers, now, remainingSec, start, pause, resume, addMinute, dismiss, lastFinished]
  );

  return <KitchenTimersContext.Provider value={value}>{children}</KitchenTimersContext.Provider>;
}

export function useKitchenTimers() {
  const ctx = useContext(KitchenTimersContext);
  if (!ctx) throw new Error("useKitchenTimers must be used within KitchenTimersProvider");
  return ctx;
}

export function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
