import { create } from 'zustand';
import { todayKey } from '../db/client';
import type { Habit, HabitLog, Prayer, PrayerLog, WishlistItem } from '../db/types';
import { PRAYERS } from '../db/types';
import * as repo from '../db/repositories/life';

interface LifeState {
  loaded: boolean;
  wishlist: WishlistItem[];
  habits: Habit[];
  todayHabitLogs: HabitLog[];
  todayPrayerLogs: PrayerLog[];
  prayerStreak: number;

  hydrate: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  refreshHabits: () => Promise<void>;
  refreshToday: () => Promise<void>;

  addWishlistItem: (input: Parameters<typeof repo.createWishlistItem>[0]) => Promise<void>;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;

  addHabit: (input: Parameters<typeof repo.createHabit>[0]) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleHabitToday: (habitId: string, completed: boolean) => Promise<void>;

  togglePrayer: (prayer: Prayer, completed: boolean) => Promise<void>;
  isPrayerDone: (prayer: Prayer) => boolean;
}

export const useLifeStore = create<LifeState>((set, get) => ({
  loaded: false,
  wishlist: [],
  habits: [],
  todayHabitLogs: [],
  todayPrayerLogs: [],
  prayerStreak: 0,

  hydrate: async () => {
    const [wishlist, habits] = await Promise.all([repo.listWishlistItems(), repo.listHabits()]);
    set({ wishlist, habits, loaded: true });
    await get().refreshToday();
  },
  refreshWishlist: async () => set({ wishlist: await repo.listWishlistItems() }),
  refreshHabits: async () => set({ habits: await repo.listHabits() }),
  refreshToday: async () => {
    const key = todayKey();
    const [todayHabitLogs, todayPrayerLogs, prayerStreak] = await Promise.all([
      repo.listHabitLogsForDate(key),
      repo.listPrayerLogsForDate(key),
      repo.computePrayerStreak(),
    ]);
    set({ todayHabitLogs, todayPrayerLogs, prayerStreak });
  },

  addWishlistItem: async (input) => {
    await repo.createWishlistItem(input);
    await get().refreshWishlist();
  },
  updateWishlistItem: async (id, patch) => {
    await repo.updateWishlistItem(id, patch);
    await get().refreshWishlist();
  },
  removeWishlistItem: async (id) => {
    await repo.deleteWishlistItem(id);
    await get().refreshWishlist();
  },

  addHabit: async (input) => {
    await repo.createHabit(input);
    await get().refreshHabits();
  },
  removeHabit: async (id) => {
    await repo.deleteHabit(id);
    await get().refreshHabits();
  },
  toggleHabitToday: async (habitId, completed) => {
    await repo.setHabitLog(habitId, todayKey(), completed);
    await get().refreshToday();
  },

  togglePrayer: async (prayer, completed) => {
    await repo.setPrayerLog(todayKey(), prayer, completed);
    await get().refreshToday();
  },
  isPrayerDone: (prayer) => {
    return get().todayPrayerLogs.some((p) => p.prayer === prayer && p.completed === 1);
  },
}));

export { PRAYERS };
