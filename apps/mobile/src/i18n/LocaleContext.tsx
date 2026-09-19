import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations, type Locale, type TranslationKey } from "./translations";

const STORAGE_KEY = "cookmate.locale";

// Module-level mirror of the current locale so non-React code (the axios
// client) can read it without needing a hook. Kept in sync by the provider.
let currentLocale: Locale = "en";
export function getCurrentLocale(): Locale {
  return currentLocale;
}

type LocaleContextValue = {
  locale: Locale;
  isRTL: boolean;
  isLoading: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, key) => acc.replace(`{${key}}`, String(vars[key])), template);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const initial: Locale = stored === "ar" ? "ar" : "en";
        currentLocale = initial;
        setLocaleState(initial);
        const shouldBeRTL = initial === "ar";
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setLocale = useCallback(
    async (next: Locale) => {
      currentLocale = next;
      setLocaleState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);
      const shouldBeRTL = next === "ar";
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        Alert.alert(
          next === "ar" ? "تم تغيير اللغة" : "Language changed",
          translations[next]["profile.restartHint"]
        );
      }
    },
    []
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => format(translations[locale][key], vars),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, isRTL: locale === "ar", isLoading, setLocale, t }),
    [locale, isLoading, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
