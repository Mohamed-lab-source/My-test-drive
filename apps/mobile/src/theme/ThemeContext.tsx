import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCENT_PRESETS, darkColors, lightColors, type AccentKey, type ThemeColors } from "../theme";

const STORAGE_KEY = "cookmate.themePreference";
const ACCENT_STORAGE_KEY = "cookmate.accentColor";
const HIGH_CONTRAST_KEY = "cookmate.highContrast";

/** Stronger text and borders for low vision or bright kitchens; layered over light/dark. */
const HIGH_CONTRAST = {
  light: { text: "#000000", textMuted: "#2B2B2B", border: "#6B6B6B", background: "#FFFFFF", surface: "#FFFFFF" },
  dark: { text: "#FFFFFF", textMuted: "#E0E0E0", border: "#A0A0A0", background: "#000000", surface: "#121212" },
};

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  accent: AccentKey;
  isLoading: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
  setAccent: (accent: AccentKey) => Promise<void>;
  highContrast: boolean;
  setHighContrast: (on: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [accent, setAccentState] = useState<AccentKey>("orange");
  const [isLoading, setIsLoading] = useState(true);
  const [highContrast, setHighContrastState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [stored, storedAccent, storedContrast] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
          AsyncStorage.getItem(HIGH_CONTRAST_KEY),
        ]);
        setHighContrastState(storedContrast === "true");
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
  const setHighContrast = useCallback((on: boolean) => {
    setHighContrastState(on);
    AsyncStorage.setItem(HIGH_CONTRAST_KEY, String(on)).catch(() => {});
  }, []);

  const colors: ThemeColors = useMemo(
    () => ({
      ...baseColors,
      ...accentColors,
      ...(highContrast ? HIGH_CONTRAST[isDark ? "dark" : "light"] : {}),
    }),
    [baseColors, accentColors, highContrast, isDark]
  );

  const value = useMemo(
    () => ({ colors, isDark, preference, accent, isLoading, setPreference, setAccent, highContrast, setHighContrast }),
    [colors, isDark, preference, accent, isLoading, setPreference, setAccent, highContrast, setHighContrast]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
