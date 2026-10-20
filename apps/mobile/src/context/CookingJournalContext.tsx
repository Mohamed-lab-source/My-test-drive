import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.cookingJournal";
const MAX_ENTRIES = 300;

/** One finished Cook Mode session. */
export type JournalEntry = {
  id: string;
  slug: string;
  title: string;
  cuisineSlug: string;
  /** ISO timestamp of when cooking finished. */
  finishedAt: string;
  /** Minutes from opening Cook Mode to tapping Finish. */
  durationMin: number;
  servings: number;
  /** Estimated EGP per serving at the time; missing on older entries. */
  costPerServing?: number;
  note: string;
};

type CookingJournalContextValue = {
  entries: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, "id" | "note">) => JournalEntry;
  updateNote: (id: string, note: string) => void;
  removeEntry: (id: string) => void;
};

const CookingJournalContext = createContext<CookingJournalContextValue | undefined>(undefined);

export function CookingJournalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setEntries(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: JournalEntry[]) => JournalEntry[]) => {
    setEntries((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addEntry = useCallback(
    (input: Omit<JournalEntry, "id" | "note">) => {
      const entry: JournalEntry = { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, note: "" };
      update((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
      return entry;
    },
    [update]
  );

  const updateNote = useCallback(
    (id: string, note: string) => update((prev) => prev.map((e) => (e.id === id ? { ...e, note } : e))),
    [update]
  );

  const removeEntry = useCallback((id: string) => update((prev) => prev.filter((e) => e.id !== id)), [update]);

  const value = useMemo(() => ({ entries, addEntry, updateNote, removeEntry }), [entries, addEntry, updateNote, removeEntry]);

  return <CookingJournalContext.Provider value={value}>{children}</CookingJournalContext.Provider>;
}

export function useCookingJournal() {
  const ctx = useContext(CookingJournalContext);
  if (!ctx) throw new Error("useCookingJournal must be used within CookingJournalProvider");
  return ctx;
}
