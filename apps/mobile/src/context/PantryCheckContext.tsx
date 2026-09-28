import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.pantryHaveAlready";

type PantryCheckContextValue = {
  isChecked: (ingredientName: string) => boolean;
  toggle: (ingredientName: string) => void;
  clear: () => void;
  checkedCount: (ingredientNames: string[]) => number;
};

const PantryCheckContext = createContext<PantryCheckContextValue | undefined>(undefined);

export function PantryCheckProvider({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setChecked(new Set(JSON.parse(stored) as string[]));
      })
      .catch(() => {});
  }, []);

  const persist = (next: Set<string>) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {});
  };

  const toggle = useCallback((ingredientName: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientName)) next.delete(ingredientName);
      else next.add(ingredientName);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setChecked(new Set());
    persist(new Set());
  }, []);

  const isChecked = useCallback((ingredientName: string) => checked.has(ingredientName), [checked]);
  const checkedCount = useCallback(
    (ingredientNames: string[]) => ingredientNames.filter((n) => checked.has(n)).length,
    [checked]
  );

  const value = useMemo(
    () => ({ isChecked, toggle, clear, checkedCount }),
    [isChecked, toggle, clear, checkedCount]
  );

  return <PantryCheckContext.Provider value={value}>{children}</PantryCheckContext.Provider>;
}

export function usePantryCheck() {
  const ctx = useContext(PantryCheckContext);
  if (!ctx) throw new Error("usePantryCheck must be used within PantryCheckProvider");
  return ctx;
}
