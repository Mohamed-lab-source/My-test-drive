import { newId, nowIso, todayKey } from '../client';
import { allRows, deleteRow, insertRow, updateRow, whereRows } from '../helpers';
import type { Habit, HabitLog } from '../types';

export const listHabits = () => allRows<Habit>('habits', 'sort_order ASC, created_at ASC');

export async function createHabit(input: Omit<Habit, 'id' | 'is_archived' | 'created_at'>): Promise<string> {
  const id = newId();
  await insertRow('habits', { id, ...input, is_archived: 0, created_at: nowIso() });
  return id;
}
export const updateHabit = (id: string, patch: Partial<Habit>) => updateRow('habits', id, patch);
export const deleteHabit = (id: string) => deleteRow('habits', id);

export const listHabitLogsForDate = (date: string) => whereRows<HabitLog>('habit_logs', 'date = ?', [date]);

export async function setHabitLog(habitId: string, date: string, completed: boolean): Promise<void> {
  const existing = await whereRows<HabitLog>('habit_logs', 'habit_id = ? AND date = ?', [habitId, date]);
  if (existing.length > 0) {
    await updateRow('habit_logs', existing[0].id, { completed: completed ? 1 : 0 });
  } else {
    await insertRow('habit_logs', { id: newId(), habit_id: habitId, date, completed: completed ? 1 : 0 });
  }
}

export async function computeHabitStreak(habitId: string): Promise<number> {
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 3650; i++) {
    const key = todayKey(cursor);
    const rows = await whereRows<HabitLog>('habit_logs', 'habit_id = ? AND date = ? AND completed = 1', [habitId, key]);
    if (rows.length > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
