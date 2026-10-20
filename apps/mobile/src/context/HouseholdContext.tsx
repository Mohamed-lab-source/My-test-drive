import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Allergen } from "../api/types";

const STORAGE_KEY = "cookmate.household";
const MAX_MEMBERS = 12;

export type HouseholdMember = {
  id: string;
  name: string;
  emoji: string;
  isKid: boolean;
  allergies: Allergen[];
};

export type MemberConflict = { member: HouseholdMember; allergens: Allergen[] };

type HouseholdContextValue = {
  members: HouseholdMember[];
  addMember: (input: Omit<HouseholdMember, "id">) => void;
  updateMember: (id: string, patch: Partial<Omit<HouseholdMember, "id">>) => void;
  removeMember: (id: string) => void;
  /**
   * Portions for a group: adults count 1, kids half, rounded up. With no ids,
   * counts the whole household. Returns null when no household is set up.
   */
  servingsFor: (memberIds?: string[]) => number | null;
  /** Members (optionally just those eating) who are allergic to any of the given allergens. */
  conflictsFor: (allergens: Allergen[], memberIds?: string[]) => MemberConflict[];
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setMembers(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: HouseholdMember[]) => HouseholdMember[]) => {
    setMembers((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addMember = useCallback(
    (input: Omit<HouseholdMember, "id">) =>
      update((prev) =>
        prev.length >= MAX_MEMBERS
          ? prev
          : [...prev, { ...input, name: input.name.trim(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]
      ),
    [update]
  );

  const updateMember = useCallback(
    (id: string, patch: Partial<Omit<HouseholdMember, "id">>) =>
      update((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    [update]
  );

  const removeMember = useCallback((id: string) => update((prev) => prev.filter((m) => m.id !== id)), [update]);

  const pick = useCallback(
    (memberIds?: string[]) => (memberIds ? members.filter((m) => memberIds.includes(m.id)) : members),
    [members]
  );

  const servingsFor = useCallback(
    (memberIds?: string[]) => {
      if (members.length === 0) return null;
      const group = pick(memberIds);
      if (group.length === 0) return null;
      return Math.max(1, Math.ceil(group.reduce((sum, m) => sum + (m.isKid ? 0.5 : 1), 0)));
    },
    [members.length, pick]
  );

  const conflictsFor = useCallback(
    (allergens: Allergen[], memberIds?: string[]) =>
      pick(memberIds)
        .map((member) => ({ member, allergens: allergens.filter((a) => member.allergies.includes(a)) }))
        .filter((c) => c.allergens.length > 0),
    [pick]
  );

  const value = useMemo(
    () => ({ members, addMember, updateMember, removeMember, servingsFor, conflictsFor }),
    [members, addMember, updateMember, removeMember, servingsFor, conflictsFor]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
