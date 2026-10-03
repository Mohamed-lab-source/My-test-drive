import { getDb, todayKey } from './client';
import { convertToBase } from './repositories/fx';
import type { FxRate, JournalMood, Transaction } from './types';
import { PRAYERS } from './types';

export interface WeeklyReview {
  tasksCompleted: number;
  focusMinutes: number;
  spent: number;
  spentPrevWeek: number;
  income: number;
  prayersDone: number;
  prayersPossible: number;
  habitRate: number | null;
  moods: JournalMood[];
  dhikr: number;
  quranPages: number;
}

const DAYS = 7;

// Covers the last 7 days including today (local calendar days). Money is
// converted to the base currency; spend is compared with the 7 days before.
export async function getWeeklyReview(baseCurrency: string, fxRates: FxRate[]): Promise<WeeklyReview> {
  const db = await getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1));
  const prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (2 * DAYS - 1));
  const startIso = start.toISOString();
  const startKey = todayKey(start);

  const one = async (sql: string, params: (string | number)[]) =>
    (await db.getFirstAsync<{ n: number | null }>(sql, params))?.n ?? 0;

  const [tasksCompleted, focusMinutes, prayersDone, habitCount, habitDone, dhikr, quranPages, moods, txs] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND completed_at >= ?", [startIso]),
    one('SELECT SUM(minutes) AS n FROM focus_sessions WHERE completed_at >= ?', [startIso]),
    one('SELECT COUNT(*) AS n FROM prayer_logs WHERE completed = 1 AND date >= ?', [startKey]),
    one('SELECT COUNT(*) AS n FROM habits WHERE is_archived = 0', []),
    one('SELECT COUNT(*) AS n FROM habit_logs WHERE completed = 1 AND date >= ?', [startKey]),
    one('SELECT SUM(count) AS n FROM dhikr_logs WHERE date >= ?', [startKey]),
    one('SELECT SUM(pages) AS n FROM quran_logs WHERE date >= ?', [startKey]),
    db.getAllAsync<{ mood: JournalMood }>('SELECT mood FROM journal_entries WHERE date >= ? ORDER BY date ASC', [startKey]),
    db.getAllAsync<Transaction>("SELECT * FROM transactions WHERE date >= ? AND type != 'transfer'", [prevStart.toISOString()]),
  ]);

  let spent = 0;
  let spentPrevWeek = 0;
  let income = 0;
  for (const t of txs) {
    const amount = convertToBase(t.amount, t.currency, baseCurrency, fxRates);
    const thisWeek = t.date >= startIso;
    if (t.type === 'expense') {
      if (thisWeek) spent += amount;
      else spentPrevWeek += amount;
    } else if (thisWeek) {
      income += amount;
    }
  }

  return {
    tasksCompleted,
    focusMinutes,
    spent,
    spentPrevWeek,
    income,
    prayersDone,
    prayersPossible: PRAYERS.length * DAYS,
    habitRate: habitCount > 0 ? habitDone / (habitCount * DAYS) : null,
    moods: moods.map((m) => m.mood),
    dhikr,
    quranPages,
  };
}
