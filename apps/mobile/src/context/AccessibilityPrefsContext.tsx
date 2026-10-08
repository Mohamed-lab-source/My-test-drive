import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REDUCE_MOTION_KEY = "cookmate.reduceMotion";
const HAPTICS_KEY = "cookmate.hapticsEnabled";

type AccessibilityPrefsContextValue = {
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  isLoading: boolean;
  setReduceMotion: (value: boolean) => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;
};

const AccessibilityPrefsContext = createContext<AccessibilityPrefsContextValue | undefined>(undefined);

export function AccessibilityPrefsProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedMotion, storedHaptics] = await Promise.all([
          AsyncStorage.getItem(REDUCE_MOTION_KEY),
          AsyncStorage.getItem(HAPTICS_KEY),
        ]);
        if (storedMotion != null) setReduceMotionState(storedMotion === "true");
        if (storedHaptics != null) setHapticsEnabledState(storedHaptics === "true");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setReduceMotion = useCallback(async (value: boolean) => {
    setReduceMotionState(value);
    await AsyncStorage.setItem(REDUCE_MOTION_KEY, String(value));
  }, []);

  const setHapticsEnabled = useCallback(async (value: boolean) => {
    setHapticsEnabledState(value);
    await AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }, []);

  const value = useMemo(
    () => ({ reduceMotion, hapticsEnabled, isLoading, setReduceMotion, setHapticsEnabled }),
    [reduceMotion, hapticsEnabled, isLoading, setReduceMotion, setHapticsEnabled]
  );

  return <AccessibilityPrefsContext.Provider value={value}>{children}</AccessibilityPrefsContext.Provider>;
}

export function useAccessibilityPrefs() {
  const ctx = useContext(AccessibilityPrefsContext);
  if (!ctx) throw new Error("useAccessibilityPrefs must be used within AccessibilityPrefsProvider");
  return ctx;
}
