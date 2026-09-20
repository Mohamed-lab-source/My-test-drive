import { getDb, newId, nowIso, todayKey } from '../client';
import { allRows, deleteRow, insertRow, updateRow, whereRows } from '../helpers';
import type { Habit, HabitLog, Prayer, PrayerLog, WishlistItem } from '../types';
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

// ---------- Habits ----------
export const listHabits = () => allRows<Habit>('habits', 'sort_order ASC');

export async function createHabit(input: Omit<Habit, 'id' | 'created_at' | 'is_archived'>) {
  const id = newId();
  await insertRow('habits', { id, ...input, is_archived: 0, created_at: nowIso() });
  return id;
}
export const updateHabit = (id: string, patch: Partial<Habit>) => updateRow('habits', id, patch);
export const deleteHabit = (id: string) => deleteRow('habits', id);

export const listHabitLogsForDate = (date: string) =>
  whereRows<HabitLog>('habit_logs', 'date = ?', [date]);

export const listHabitLogsForHabit = (habitId: string, sinceDate: string) =>
  whereRows<HabitLog>('habit_logs', 'habit_id = ? AND date >= ?', [habitId, sinceDate], 'date ASC');

export async function setHabitLog(habitId: string, date: string, completed: boolean) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habit_logs (id, habit_id, date, completed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed`,
    [newId(), habitId, date, completed ? 1 : 0]
  );
}

// ---------- Prayer tracker ----------
export const listPrayerLogsForDate = (date: string) =>
  whereRows<PrayerLog>('prayer_logs', 'date = ?', [date]);

export const listPrayerLogsSince = (sinceDate: string) =>
  whereRows<PrayerLog>('prayer_logs', 'date >= ?', [sinceDate], 'date ASC');

export async function setPrayerLog(date: string, prayer: Prayer, completed: boolean) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO prayer_logs (id, date, prayer, completed, completed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, prayer) DO UPDATE SET completed = excluded.completed, completed_at = excluded.completed_at`,
    [newId(), date, prayer, completed ? 1 : 0, completed ? nowIso() : null]
  );
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
