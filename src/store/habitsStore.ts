import { create } from 'zustand';
import { todayKey } from '../db/client';
import type { Habit, HabitLog } from '../db/types';
import * as repo from '../db/repositories/habits';

interface HabitState {
  loaded: boolean;
  habits: Habit[];
  todayLogs: HabitLog[];
  streaks: Record<string, number>;

  hydrate: () => Promise<void>;
  refreshToday: () => Promise<void>;

  addHabit: (input: Parameters<typeof repo.createHabit>[0]) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleHabit: (habitId: string, completed: boolean) => Promise<void>;
  isHabitDoneToday: (habitId: string) => boolean;
}

export const useHabitsStore = create<HabitState>((set, get) => ({
  loaded: false,
  habits: [],
  todayLogs: [],
  streaks: {},

  hydrate: async () => {
    const habits = await repo.listHabits();
    set({ habits, loaded: true });
    await get().refreshToday();
  },

  refreshToday: async () => {
    const habits = get().habits;
    const [todayLogs, streakEntries] = await Promise.all([
      repo.listHabitLogsForDate(todayKey()),
      Promise.all(habits.map(async (h) => [h.id, await repo.computeHabitStreak(h.id)] as const)),
    ]);
    set({ todayLogs, streaks: Object.fromEntries(streakEntries) });
  },

  addHabit: async (input) => {
    await repo.createHabit(input);
    set({ habits: await repo.listHabits() });
    await get().refreshToday();
  },
  removeHabit: async (id) => {
    await repo.deleteHabit(id);
    set({ habits: await repo.listHabits() });
    await get().refreshToday();
  },
  toggleHabit: async (habitId, completed) => {
    await repo.setHabitLog(habitId, todayKey(), completed);
    await get().refreshToday();
  },
  isHabitDoneToday: (habitId) => get().todayLogs.some((l) => l.habit_id === habitId && l.completed === 1),
}));
