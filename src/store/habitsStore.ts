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
  moveHabit: (id: string, direction: 'up' | 'down') => Promise<void>;
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
  moveHabit: async (id, direction) => {
    const list = get().habits;
    const i = list.findIndex((h) => h.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    // Normalise first so equal sort_orders (e.g. 0, 0) can still swap.
    for (const [k, h] of list.entries()) if (h.sort_order !== k) await repo.updateHabit(h.id, { sort_order: k });
    await repo.updateHabit(list[i].id, { sort_order: j });
    await repo.updateHabit(list[j].id, { sort_order: i });
    set({ habits: await repo.listHabits() });
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
