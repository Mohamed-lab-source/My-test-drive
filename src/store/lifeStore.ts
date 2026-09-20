import { create } from 'zustand';
import { todayKey } from '../db/client';
import type { Prayer, PrayerLog, WishlistItem } from '../db/types';
import { PRAYERS } from '../db/types';
import * as repo from '../db/repositories/life';

interface LifeState {
  loaded: boolean;
  wishlist: WishlistItem[];
  todayPrayerLogs: PrayerLog[];
  prayerStreak: number;

  hydrate: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  refreshToday: () => Promise<void>;

  addWishlistItem: (input: Parameters<typeof repo.createWishlistItem>[0]) => Promise<void>;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;

  togglePrayer: (prayer: Prayer, completed: boolean) => Promise<void>;
  isPrayerDone: (prayer: Prayer) => boolean;
}

export const useLifeStore = create<LifeState>((set, get) => ({
  loaded: false,
  wishlist: [],
  todayPrayerLogs: [],
  prayerStreak: 0,

  hydrate: async () => {
    const wishlist = await repo.listWishlistItems();
    set({ wishlist, loaded: true });
    await get().refreshToday();
  },
  refreshWishlist: async () => set({ wishlist: await repo.listWishlistItems() }),
  refreshToday: async () => {
    const key = todayKey();
    const [todayPrayerLogs, prayerStreak] = await Promise.all([
      repo.listPrayerLogsForDate(key),
      repo.computePrayerStreak(),
    ]);
    set({ todayPrayerLogs, prayerStreak });
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

  togglePrayer: async (prayer, completed) => {
    await repo.setPrayerLog(todayKey(), prayer, completed);
    await get().refreshToday();
  },
  isPrayerDone: (prayer) => {
    return get().todayPrayerLogs.some((p) => p.prayer === prayer && p.completed === 1);
  },
}));

export { PRAYERS };
