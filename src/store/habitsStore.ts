import { create } from 'zustand';
import { todayKey } from '../db/client';
import type { Habit, HabitLog } from '../db/types';
import * as repo from '../db/repositories/habits';
import { cancelHabitReminder, scheduleHabitReminder } from '../notifications/scheduler';

interface HabitState {
  loaded: boolean;
  habits: Habit[];
  todayLogs: HabitLog[];
  streaks: Record<string, number>;

  hydrate: () => Promise<void>;
  refreshToday: () => Promise<void>;

  addHabit: (input: Parameters<typeof repo.createHabit>[0]) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  setHabitReminder: (id: string, time: string | null) => Promise<void>;
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
    const id = await repo.createHabit(input);
    const habits = await repo.listHabits();
    set({ habits });
    const created = habits.find((h) => h.id === id);
    if (created) scheduleHabitReminder(created);
    await get().refreshToday();
  },
  setHabitReminder: async (id, time) => {
    await repo.updateHabit(id, { remind_time: time });
    const habits = await repo.listHabits();
    set({ habits });
    const habit = habits.find((h) => h.id === id);
    if (habit) await scheduleHabitReminder(habit);
  },
  removeHabit: async (id) => {
    await cancelHabitReminder(id);
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
