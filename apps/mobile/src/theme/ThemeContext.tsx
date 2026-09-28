import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCENT_PRESETS, darkColors, lightColors, type AccentKey, type ThemeColors } from "../theme";

const STORAGE_KEY = "cookmate.themePreference";
const ACCENT_STORAGE_KEY = "cookmate.accentColor";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  accent: AccentKey;
  isLoading: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
  setAccent: (accent: AccentKey) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [accent, setAccentState] = useState<AccentKey>("orange");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stored, storedAccent] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        ]);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
        if (storedAccent && storedAccent in ACCENT_PRESETS) {
          setAccentState(storedAccent as AccentKey);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const setAccent = useCallback(async (next: AccentKey) => {
    setAccentState(next);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, next);
  }, []);

  const isDark = preference === "system" ? systemScheme === "dark" : preference === "dark";
  const baseColors = isDark ? darkColors : lightColors;
  const accentColors = ACCENT_PRESETS[accent][isDark ? "dark" : "light"];
  const colors: ThemeColors = { ...baseColors, ...accentColors };

  const value = useMemo(
    () => ({ colors, isDark, preference, accent, isLoading, setPreference, setAccent }),
    [colors, isDark, preference, accent, isLoading, setPreference, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
