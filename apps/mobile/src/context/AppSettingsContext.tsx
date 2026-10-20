import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_QUIET_HOURS, setQuietHoursMirror, type QuietHours } from "../utils/quietHours";
import type { MainTabParamList } from "../navigation/types";

const STORAGE_KEY = "cookmate.appSettings";

export type StartTab = keyof MainTabParamList;

type StoredSettings = { startTab: StartTab; quietHours: QuietHours };

const DEFAULTS: StoredSettings = { startTab: "Home", quietHours: DEFAULT_QUIET_HOURS };

type AppSettingsContextValue = StoredSettings & {
  isLoading: boolean;
  setStartTab: (tab: StartTab) => void;
  setQuietHours: (patch: Partial<QuietHours>) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<StoredSettings>;
        const next = { ...DEFAULTS, ...parsed, quietHours: { ...DEFAULT_QUIET_HOURS, ...parsed.quietHours } };
        setQuietHoursMirror(next.quietHours);
        setSettings(next);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const update = useCallback((updater: (prev: StoredSettings) => StoredSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      setQuietHoursMirror(next.quietHours);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setStartTab = useCallback((startTab: StartTab) => update((prev) => ({ ...prev, startTab })), [update]);
  const setQuietHours = useCallback(
    (patch: Partial<QuietHours>) => update((prev) => ({ ...prev, quietHours: { ...prev.quietHours, ...patch } })),
    [update]
  );

  const value = useMemo(
    () => ({ ...settings, isLoading, setStartTab, setQuietHours }),
    [settings, isLoading, setStartTab, setQuietHours]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}
