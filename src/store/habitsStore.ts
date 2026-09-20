import { create } from 'zustand';
import type { CheckIn, Habit, Identity, ScorecardEntry } from '../domain/habits/types';
import * as repo from '../db/repositories/habits';

interface HabitsState {
  loaded: boolean;
  identities: Identity[];
  habits: Habit[];
  checkins: CheckIn[];
  scorecardEntries: ScorecardEntry[];

  hydrate: () => Promise<void>;
  refreshHabits: () => Promise<void>;
  refreshCheckins: () => Promise<void>;
  refreshIdentities: () => Promise<void>;
  refreshScorecard: () => Promise<void>;

  addIdentity: (statement: string, why: string) => Promise<void>;
  updateIdentity: (id: string, patch: { statement?: string; why?: string }) => Promise<void>;
  archiveIdentity: (id: string) => Promise<void>;
  deleteIdentity: (id: string) => Promise<void>;

  addHabit: (input: repo.NewHabitInput) => Promise<void>;
  updateHabit: (id: string, patch: Partial<repo.NewHabitInput>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;

  setCheckIn: (habitId: string, date: string, patch: repo.CheckInPatch) => Promise<void>;
  clearCheckIn: (habitId: string, date: string) => Promise<void>;

  addScorecardEntry: (activity: string, rating: '+' | '-' | '=', note: string) => Promise<void>;
  removeScorecardEntry: (id: string) => Promise<void>;
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  loaded: false,
  identities: [],
  habits: [],
  checkins: [],
  scorecardEntries: [],

  hydrate: async () => {
    const [identities, habits, checkins, scorecardEntries] = await Promise.all([
      repo.listIdentities(),
      repo.listHabits(),
      repo.listCheckins(),
      repo.listScorecardEntries(),
    ]);
    set({ identities, habits, checkins, scorecardEntries, loaded: true });
  },

  refreshHabits: async () => set({ habits: await repo.listHabits() }),
  refreshCheckins: async () => set({ checkins: await repo.listCheckins() }),
  refreshIdentities: async () => set({ identities: await repo.listIdentities() }),
  refreshScorecard: async () => set({ scorecardEntries: await repo.listScorecardEntries() }),

  addIdentity: async (statement, why) => {
    await repo.createIdentity(statement, why);
    await get().refreshIdentities();
  },
  updateIdentity: async (id, patch) => {
    await repo.updateIdentity(id, patch);
    await get().refreshIdentities();
  },
  archiveIdentity: async (id) => {
    await repo.archiveIdentity(id);
    await get().refreshIdentities();
  },
  deleteIdentity: async (id) => {
    await repo.deleteIdentity(id);
    await get().refreshIdentities();
  },

  addHabit: async (input) => {
    await repo.createHabit(input);
    await get().refreshHabits();
  },
  updateHabit: async (id, patch) => {
    await repo.updateHabit(id, patch);
    await get().refreshHabits();
  },
  archiveHabit: async (id) => {
    await repo.archiveHabit(id);
    await get().refreshHabits();
  },
  deleteHabit: async (id) => {
    await repo.deleteHabit(id);
    await get().refreshHabits();
  },

  setCheckIn: async (habitId, date, patch) => {
    await repo.setCheckIn(habitId, date, patch);
    await get().refreshCheckins();
  },
  clearCheckIn: async (habitId, date) => {
    await repo.clearCheckIn(habitId, date);
    await get().refreshCheckins();
  },

  addScorecardEntry: async (activity, rating, note) => {
    await repo.createScorecardEntry(activity, rating, note);
    await get().refreshScorecard();
  },
  removeScorecardEntry: async (id) => {
    await repo.deleteScorecardEntry(id);
    await get().refreshScorecard();
  },
}));
