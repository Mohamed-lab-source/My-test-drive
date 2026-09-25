import { create } from 'zustand';
import { todayKey } from '../db/client';
import type { JournalEntry, JournalMood, Prayer, PrayerLog, WishlistItem } from '../db/types';
import { PRAYERS } from '../db/types';
import * as repo from '../db/repositories/life';
import * as journalRepo from '../db/repositories/journal';
import { useFinanceStore } from './financeStore';
import { refreshPrayerWidget } from '../widgets/refresh';

interface LifeState {
  loaded: boolean;
  wishlist: WishlistItem[];
  todayPrayerLogs: PrayerLog[];
  prayerStreak: number;
  journalEntries: JournalEntry[];

  hydrate: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  refreshToday: () => Promise<void>;
  refreshJournal: () => Promise<void>;

  addWishlistItem: (input: Parameters<typeof repo.createWishlistItem>[0]) => Promise<void>;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
  convertWishlistToGoal: (itemId: string) => Promise<void>;

  togglePrayer: (prayer: Prayer, completed: boolean) => Promise<void>;
  isPrayerDone: (prayer: Prayer) => boolean;

  setTodayMood: (mood: JournalMood, note: string | null) => Promise<void>;
}

export const useLifeStore = create<LifeState>((set, get) => ({
  loaded: false,
  wishlist: [],
  todayPrayerLogs: [],
  prayerStreak: 0,
  journalEntries: [],

  hydrate: async () => {
    const [wishlist, journalEntries] = await Promise.all([repo.listWishlistItems(), journalRepo.listJournalEntries()]);
    set({ wishlist, journalEntries, loaded: true });
    await get().refreshToday();
  },
  refreshJournal: async () => set({ journalEntries: await journalRepo.listJournalEntries() }),
  refreshWishlist: async () => set({ wishlist: await repo.listWishlistItems() }),
  refreshToday: async () => {
    const key = todayKey();
    const [todayPrayerLogs, prayerStreak] = await Promise.all([
      repo.listPrayerLogsForDate(key),
      repo.computePrayerStreak(),
    ]);
    set({ todayPrayerLogs, prayerStreak });
    refreshPrayerWidget();
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
  convertWishlistToGoal: async (itemId) => {
    const item = get().wishlist.find((w) => w.id === itemId);
    if (!item) return;
    await useFinanceStore.getState().addSavingsGoal({
      name: item.title,
      target_amount: item.price ?? 0,
      currency: item.currency,
      target_date: null,
      icon: 'gift.fill',
      color: '#FF9500',
      notes: item.url,
    });
    await repo.updateWishlistItem(itemId, { status: 'planned' });
    await get().refreshWishlist();
  },

  togglePrayer: async (prayer, completed) => {
    await repo.setPrayerLog(todayKey(), prayer, completed);
    await get().refreshToday();
  },
  isPrayerDone: (prayer) => {
    return get().todayPrayerLogs.some((p) => p.prayer === prayer && p.completed === 1);
  },

  setTodayMood: async (mood, note) => {
    await journalRepo.setJournalEntry(todayKey(), mood, note);
    await get().refreshJournal();
  },
}));

export { PRAYERS };
