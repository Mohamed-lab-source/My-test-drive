import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.pantryHaveAlready";

/** Matching is case- and whitespace-insensitive so a typed "olive oil" ticks "Olive Oil" on a list. */
export function normalizePantryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

type PantryCheckContextValue = {
  /** Everything marked "I have this", in the spelling it was first added with, A-Z. */
  items: string[];
  isChecked: (ingredientName: string) => boolean;
  toggle: (ingredientName: string) => void;
  add: (ingredientName: string) => void;
  remove: (ingredientName: string) => void;
  /** Marks or unmarks several names at once (e.g. a whole aisle). */
  setMany: (ingredientNames: string[], have: boolean) => void;
  clear: () => void;
  checkedCount: (ingredientNames: string[]) => number;
};

const PantryCheckContext = createContext<PantryCheckContextValue | undefined>(undefined);

function withName(prev: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return prev;
  const key = normalizePantryName(trimmed);
  return prev.some((n) => normalizePantryName(n) === key) ? prev : [...prev, trimmed];
}

function withoutName(prev: string[], name: string): string[] {
  const key = normalizePantryName(name);
  return prev.filter((n) => normalizePantryName(n) !== key);
}

export function PantryCheckProvider({ children }: { children: React.ReactNode }) {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setNames(JSON.parse(stored) as string[]);
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: string[]) => string[]) => {
    setNames((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const normalized = useMemo(() => new Set(names.map(normalizePantryName)), [names]);

  const isChecked = useCallback(
    (ingredientName: string) => normalized.has(normalizePantryName(ingredientName)),
    [normalized]
  );

  const toggle = useCallback(
    (ingredientName: string) =>
      update((prev) =>
        prev.some((n) => normalizePantryName(n) === normalizePantryName(ingredientName))
          ? withoutName(prev, ingredientName)
          : withName(prev, ingredientName)
      ),
    [update]
  );

  const add = useCallback((ingredientName: string) => update((prev) => withName(prev, ingredientName)), [update]);
  const remove = useCallback((ingredientName: string) => update((prev) => withoutName(prev, ingredientName)), [update]);

  const setMany = useCallback(
    (ingredientNames: string[], have: boolean) =>
      update((prev) => ingredientNames.reduce((acc, n) => (have ? withName(acc, n) : withoutName(acc, n)), prev)),
    [update]
  );

  const clear = useCallback(() => update(() => []), [update]);

  const checkedCount = useCallback(
    (ingredientNames: string[]) => ingredientNames.filter((n) => normalized.has(normalizePantryName(n))).length,
    [normalized]
  );

  const items = useMemo(() => [...names].sort((a, b) => a.localeCompare(b)), [names]);

  const value = useMemo(
    () => ({ items, isChecked, toggle, add, remove, setMany, clear, checkedCount }),
    [items, isChecked, toggle, add, remove, setMany, clear, checkedCount]
  );

  return <PantryCheckContext.Provider value={value}>{children}</PantryCheckContext.Provider>;
}

export function usePantryCheck() {
  const ctx = useContext(PantryCheckContext);
  if (!ctx) throw new Error("usePantryCheck must be used within PantryCheckProvider");
  return ctx;
}
