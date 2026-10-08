import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMealPlan } from "./MealPlanContext";
import { useLocale } from "../i18n/LocaleContext";
import {
  configureNotificationHandler,
  hasReminderPermission,
  requestReminderPermission,
  rescheduleMealReminders,
} from "../utils/mealReminders";

const ENABLED_KEY = "cookmate.mealReminder.enabled";
const TIME_KEY = "cookmate.mealReminder.time";

export type ReminderTime = { hour: number; minute: number };

const DEFAULT_TIME: ReminderTime = { hour: 17, minute: 0 };

type MealReminderContextValue = {
  isLoading: boolean;
  enabled: boolean;
  time: ReminderTime;
  /** Resolves to the enabled state that actually took effect -- false if permission was denied. */
  setEnabled: (value: boolean) => Promise<boolean>;
  setTime: (value: ReminderTime) => Promise<void>;
};

const MealReminderContext = createContext<MealReminderContextValue | undefined>(undefined);

export function MealReminderProvider({ children }: { children: React.ReactNode }) {
  const { plan, isLoading: planLoading } = useMealPlan();
  const { t } = useLocale();
  const [enabled, setEnabledState] = useState(false);
  const [time, setTimeState] = useState<ReminderTime>(DEFAULT_TIME);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureNotificationHandler();
    (async () => {
      try {
        const [storedEnabled, storedTime] = await Promise.all([
          AsyncStorage.getItem(ENABLED_KEY),
          AsyncStorage.getItem(TIME_KEY),
        ]);
        if (storedEnabled === "true") setEnabledState(true);
        if (storedTime) setTimeState(JSON.parse(storedTime));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || planLoading) return;
    rescheduleMealReminders(plan, enabled, time, (recipeTitle) => ({
      title: t("mealReminder.notificationTitle"),
      body: t("mealReminder.notificationBody", { title: recipeTitle }),
    })).catch(() => {});
  }, [plan, enabled, time, isLoading, planLoading, t]);

  const setEnabled = useCallback(async (value: boolean) => {
    if (value) {
      const granted = (await hasReminderPermission()) || (await requestReminderPermission());
      if (!granted) {
        setEnabledState(false);
        await AsyncStorage.setItem(ENABLED_KEY, "false");
        return false;
      }
    }
    setEnabledState(value);
    await AsyncStorage.setItem(ENABLED_KEY, String(value));
    return value;
  }, []);

  const setTime = useCallback(async (value: ReminderTime) => {
    setTimeState(value);
    await AsyncStorage.setItem(TIME_KEY, JSON.stringify(value));
  }, []);

  const value = useMemo(
    () => ({ isLoading, enabled, time, setEnabled, setTime }),
    [isLoading, enabled, time, setEnabled, setTime]
  );

  return <MealReminderContext.Provider value={value}>{children}</MealReminderContext.Provider>;
}

export function useMealReminder() {
  const ctx = useContext(MealReminderContext);
  if (!ctx) throw new Error("useMealReminder must be used within MealReminderProvider");
  return ctx;
}
