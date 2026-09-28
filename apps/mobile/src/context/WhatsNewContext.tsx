import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHANGELOG_ENTRIES } from "../data/changelog";

const STORAGE_KEY = "cookmate.whatsNewLastSeenDate";

const LATEST_DATE = CHANGELOG_ENTRIES[0]?.date ?? "";

type WhatsNewContextValue = {
  hasUnseen: boolean;
  markSeen: () => void;
};

const WhatsNewContext = createContext<WhatsNewContextValue | undefined>(undefined);

export function WhatsNewProvider({ children }: { children: React.ReactNode }) {
  const [lastSeenDate, setLastSeenDate] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setLastSeenDate(stored ?? ""))
      .catch(() => setLastSeenDate(""));
  }, []);

  const markSeen = useCallback(() => {
    setLastSeenDate(LATEST_DATE);
    AsyncStorage.setItem(STORAGE_KEY, LATEST_DATE).catch(() => {});
  }, []);

  const hasUnseen = lastSeenDate !== null && lastSeenDate < LATEST_DATE;

  const value = useMemo(() => ({ hasUnseen, markSeen }), [hasUnseen, markSeen]);

  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>;
}

export function useWhatsNew() {
  const ctx = useContext(WhatsNewContext);
  if (!ctx) throw new Error("useWhatsNew must be used within WhatsNewProvider");
  return ctx;
}
