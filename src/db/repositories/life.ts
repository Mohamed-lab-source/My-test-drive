import { getDb, newId, nowIso, todayKey } from '../client';
import { allRows, deleteRow, getRow, insertRow, updateRow, whereRows } from '../helpers';
import type {
  AdhkarLog,
  AdhkarSession,
  DhikrLog,
  FastKind,
  FastingLog,
  Prayer,
  PrayerLog,
  QadaCount,
  QuranLog,
  WishlistItem,
} from '../types';
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

// ---------- Dhikr (tasbih) ----------
export async function getDhikrCount(date: string): Promise<number> {
  const rows = await whereRows<DhikrLog>('dhikr_logs', 'date = ?', [date]);
  return rows[0]?.count ?? 0;
}

export async function setDhikrCount(date: string, count: number): Promise<void> {
  const existing = await whereRows<DhikrLog>('dhikr_logs', 'date = ?', [date]);
  if (existing.length > 0) {
    await updateRow('dhikr_logs', existing[0].id, { count });
  } else {
    await insertRow('dhikr_logs', { id: newId(), date, count });
  }
}

// ---------- Quran khatm tracker ----------
export async function getCurrentKhatm(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ k: number | null }>('SELECT MAX(khatm) AS k FROM quran_logs');
  return row?.k ?? 1;
}

export const listQuranLogs = (khatm: number) =>
  whereRows<QuranLog>('quran_logs', 'khatm = ? AND pages > 0', [khatm], 'created_at DESC');

export async function logQuranPages(pages: number): Promise<void> {
  const khatm = await getCurrentKhatm();
  await insertRow('quran_logs', { id: newId(), date: todayKey(), pages, khatm, created_at: nowIso() });
}

// A zero-page marker row bumps MAX(khatm), which is what "current" reads.
export async function startNewKhatm(): Promise<void> {
  const khatm = await getCurrentKhatm();
  await insertRow('quran_logs', { id: newId(), date: todayKey(), pages: 0, khatm: khatm + 1, created_at: nowIso() });
}

// ---------- Fasting ----------
export const listFastingLogsSince = (sinceKey: string) =>
  whereRows<FastingLog>('fasting_logs', 'date >= ?', [sinceKey], 'date DESC');

export async function setFast(date: string, kind: FastKind | null): Promise<void> {
  const existing = await whereRows<FastingLog>('fasting_logs', 'date = ?', [date]);
  if (kind === null) {
    for (const row of existing) await deleteRow('fasting_logs', row.id);
  } else if (existing.length > 0) {
    await updateRow('fasting_logs', existing[0].id, { kind });
  } else {
    await insertRow('fasting_logs', { id: newId(), date, kind });
  }
}

// ---------- Morning / evening adhkar ----------
export async function getAdhkarDone(date: string, session: AdhkarSession): Promise<string[]> {
  const row = await getRow<AdhkarLog>('adhkar_logs', `${date}-${session}`);
  try {
    return row ? (JSON.parse(row.done) as string[]) : [];
  } catch {
    return [];
  }
}

export async function setAdhkarDone(date: string, session: AdhkarSession, done: string[]): Promise<void> {
  const id = `${date}-${session}`;
  const json = JSON.stringify(done);
  if (await getRow<AdhkarLog>('adhkar_logs', id)) await updateRow('adhkar_logs', id, { done: json });
  else await insertRow('adhkar_logs', { id, date, session, done: json });
}

// ---------- Qada (make-up prayers owed) ----------
export async function getQadaCounts(): Promise<Record<Prayer, number>> {
  const rows = await allRows<QadaCount>('qada_counts', 'id ASC');
  const counts = Object.fromEntries(PRAYERS.map((p) => [p, 0])) as Record<Prayer, number>;
  for (const r of rows) if (r.id in counts) counts[r.id] = r.owed;
  return counts;
}

export async function adjustQada(prayer: Prayer, delta: number): Promise<void> {
  const row = await getRow<QadaCount>('qada_counts', prayer);
  const owed = Math.max(0, (row?.owed ?? 0) + delta);
  if (row) await updateRow('qada_counts', prayer, { owed });
  else await insertRow('qada_counts', { id: prayer, owed });
}

// Pages read per day (across every khatm) since a date key.
export async function quranPagesByDateSince(sinceKey: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; pages: number }>(
    'SELECT date, SUM(pages) AS pages FROM quran_logs WHERE date >= ? GROUP BY date',
    [sinceKey]
  );
  return Object.fromEntries(rows.map((r) => [r.date, r.pages]));
}

// Make-up fasts owed live alongside the prayer qada counts (row id 'fasts').
export async function getFastsOwed(): Promise<number> {
  return (await getRow<{ id: string; owed: number }>('qada_counts', 'fasts'))?.owed ?? 0;
}

export async function adjustFastsOwed(delta: number): Promise<void> {
  const row = await getRow<{ id: string; owed: number }>('qada_counts', 'fasts');
  const owed = Math.max(0, (row?.owed ?? 0) + delta);
  if (row) await updateRow('qada_counts', 'fasts', { owed });
  else await insertRow('qada_counts', { id: 'fasts', owed });
}

export const listDhikrSince = (sinceKey: string) => whereRows<DhikrLog>('dhikr_logs', 'date >= ?', [sinceKey], 'date ASC');
