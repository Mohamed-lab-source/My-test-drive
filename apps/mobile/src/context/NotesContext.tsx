import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.recipeNotes";

type NotesMap = Record<string, string>;

type NotesContextValue = {
  isLoading: boolean;
  getNote: (slug: string) => string;
  setNote: (slug: string, text: string) => void;
};

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NotesMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setNotes(JSON.parse(stored));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setNote = useCallback((slug: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) {
        next[slug] = text;
      } else {
        delete next[slug];
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getNote = useCallback((slug: string) => notes[slug] ?? "", [notes]);

  const value = useMemo(() => ({ isLoading, getNote, setNote }), [isLoading, getNote, setNote]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
