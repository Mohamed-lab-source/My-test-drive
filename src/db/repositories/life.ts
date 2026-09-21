import { getDb, newId, nowIso, todayKey } from '../client';
import { allRows, deleteRow, insertRow, updateRow, whereRows } from '../helpers';
import type { Prayer, PrayerLog, WishlistItem } from '../types';
import { PRAYERS } from '../types';

// ---------- Wishlist / ideas ----------
export const listWishlistItems = () => allRows<WishlistItem>('wishlist_items', 'created_at DESC');

export async function createWishlistItem(input: Omit<WishlistItem, 'id' | 'created_at'>) {
  const id = newId();
  await insertRow('wishlist_items', { id, ...input, created_at: nowIso() });
  return id;
}
export const updateWishlistItem = (id: string, patch: Partial<WishlistItem>) =>
  updateRow('wishlist_items', id, patch);
export const deleteWishlistItem = (id: string) => deleteRow('wishlist_items', id);

// ---------- Prayer tracker ----------
export const listPrayerLogsForDate = (date: string) =>
  whereRows<PrayerLog>('prayer_logs', 'date = ?', [date]);

export const listPrayerLogsSince = (sinceDate: string) =>
  whereRows<PrayerLog>('prayer_logs', 'date >= ?', [sinceDate], 'date ASC');

export async function setPrayerLog(date: string, prayer: Prayer, completed: boolean) {
  const existing = await whereRows<PrayerLog>('prayer_logs', 'date = ? AND prayer = ?', [date, prayer]);
  const completedAt = completed ? nowIso() : null;
  if (existing.length > 0) {
    await updateRow('prayer_logs', existing[0].id, { completed: completed ? 1 : 0, completed_at: completedAt });
  } else {
    await insertRow('prayer_logs', {
      id: newId(),
      date,
      prayer,
      completed: completed ? 1 : 0,
      completed_at: completedAt,
    });
  }
}

export async function computePrayerStreak(): Promise<number> {
  const db = await getDb();
  let streak = 0;
  const cursor = new Date();
  // Walk backwards day by day while all 5 prayers were completed that day.
  // Stops at the first incomplete day (today counts only once it's fully done).
  for (let i = 0; i < 3650; i++) {
    const key = todayKey(cursor);
    const rows = await db.getAllAsync<PrayerLog>(
      'SELECT * FROM prayer_logs WHERE date = ? AND completed = 1',
      [key]
    );
    if (rows.length >= PRAYERS.length) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
