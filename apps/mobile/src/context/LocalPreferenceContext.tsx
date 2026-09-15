import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DietGoal } from "../api/types";

const STORAGE_KEY = "cookmate.localPreference";

export type LocalPreference = {
  dietGoal: DietGoal;
  favoriteCuisineSlugs: string[];
  onboarded: boolean;
};

const DEFAULT_PREFERENCE: LocalPreference = {
  dietGoal: "NONE",
  favoriteCuisineSlugs: [],
  onboarded: false,
};

type LocalPreferenceContextValue = {
  preference: LocalPreference;
  isLoading: boolean;
  setPreference: (patch: Partial<LocalPreference>) => Promise<void>;
};

const LocalPreferenceContext = createContext<LocalPreferenceContextValue | undefined>(undefined);

export function LocalPreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalPreference>(DEFAULT_PREFERENCE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setPreferenceState({ ...DEFAULT_PREFERENCE, ...JSON.parse(raw) });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setPreference = useCallback(
    async (patch: Partial<LocalPreference>) => {
      const next = { ...preference, ...patch };
      setPreferenceState(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [preference]
  );

  const value = useMemo(() => ({ preference, isLoading, setPreference }), [preference, isLoading, setPreference]);

  return <LocalPreferenceContext.Provider value={value}>{children}</LocalPreferenceContext.Provider>;
}

export function useLocalPreference() {
  const ctx = useContext(LocalPreferenceContext);
  if (!ctx) throw new Error("useLocalPreference must be used within LocalPreferenceProvider");
  return ctx;
}
