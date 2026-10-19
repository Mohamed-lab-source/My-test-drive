import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.shoppingExtras";
const MAX_EXTRAS = 60;

/** Things to buy that no recipe asked for (bread, tissues, coffee...), shown on every shopping list. */
export type ShoppingExtra = { id: string; name: string; done: boolean };

type ShoppingExtrasContextValue = {
  extras: ShoppingExtra[];
  addExtra: (name: string) => void;
  toggleExtra: (id: string) => void;
  removeExtra: (id: string) => void;
  clearDoneExtras: () => void;
};

const ShoppingExtrasContext = createContext<ShoppingExtrasContextValue | undefined>(undefined);

export function ShoppingExtrasProvider({ children }: { children: React.ReactNode }) {
  const [extras, setExtras] = useState<ShoppingExtra[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setExtras(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: ShoppingExtra[]) => ShoppingExtra[]) => {
    setExtras((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addExtra = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      update((prev) => {
        if (prev.some((e) => e.name.toLowerCase() === trimmed.toLowerCase() && !e.done)) return prev;
        const extra = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed, done: false };
        return [...prev, extra].slice(-MAX_EXTRAS);
      });
    },
    [update]
  );

  const toggleExtra = useCallback(
    (id: string) => update((prev) => prev.map((e) => (e.id === id ? { ...e, done: !e.done } : e))),
    [update]
  );
  const removeExtra = useCallback((id: string) => update((prev) => prev.filter((e) => e.id !== id)), [update]);
  const clearDoneExtras = useCallback(() => update((prev) => prev.filter((e) => !e.done)), [update]);

  const value = useMemo(
    () => ({ extras, addExtra, toggleExtra, removeExtra, clearDoneExtras }),
    [extras, addExtra, toggleExtra, removeExtra, clearDoneExtras]
  );

  return <ShoppingExtrasContext.Provider value={value}>{children}</ShoppingExtrasContext.Provider>;
}

export function useShoppingExtras() {
  const ctx = useContext(ShoppingExtrasContext);
  if (!ctx) throw new Error("useShoppingExtras must be used within ShoppingExtrasProvider");
  return ctx;
}
