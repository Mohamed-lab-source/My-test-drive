import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.textSize";

export type TextSize = "small" | "medium" | "large";

const SCALE: Record<TextSize, number> = { small: 0.9, medium: 1, large: 1.2 };

type TextSizeContextValue = {
  textSize: TextSize;
  /** Multiply any base fontSize by this to respect the user's chosen text size. */
  scale: number;
  isLoading: boolean;
  setTextSize: (size: TextSize) => Promise<void>;
};

const TextSizeContext = createContext<TextSizeContextValue | undefined>(undefined);

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>("medium");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "small" || stored === "medium" || stored === "large") setTextSizeState(stored);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setTextSize = useCallback(async (size: TextSize) => {
    setTextSizeState(size);
    await AsyncStorage.setItem(STORAGE_KEY, size);
  }, []);

  const value = useMemo(
    () => ({ textSize, scale: SCALE[textSize], isLoading, setTextSize }),
    [textSize, isLoading, setTextSize]
  );

  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export function useTextSize() {
  const ctx = useContext(TextSizeContext);
  if (!ctx) throw new Error("useTextSize must be used within TextSizeProvider");
  return ctx;
}
