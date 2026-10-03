import { newId, nowIso } from '../client';
import { allRows, insertRow, updateRow, whereRows } from '../helpers';
import type { JournalEntry, JournalMood } from '../types';

export const listJournalEntries = (limit = 30) =>
  allRows<JournalEntry>('journal_entries', `date DESC LIMIT ${limit}`);

export async function setJournalEntry(
  date: string,
  mood: JournalMood,
  note: string | null,
  gratitude: string | null = null
): Promise<void> {
  const existing = await whereRows<JournalEntry>('journal_entries', 'date = ?', [date]);
  if (existing.length > 0) {
    await updateRow('journal_entries', existing[0].id, { mood, note, gratitude });
  } else {
    await insertRow('journal_entries', { id: newId(), date, mood, note, gratitude, created_at: nowIso() });
  }
}

export async function getJournalEntries(dates: string[]): Promise<JournalEntry[]> {
  if (dates.length === 0) return [];
  return whereRows<JournalEntry>('journal_entries', `date IN (${dates.map(() => '?').join(', ')})`, dates);
}

export const listGratitudeEntries = (limit = 200) =>
  whereRows<JournalEntry>('journal_entries', "gratitude IS NOT NULL AND gratitude != ''", [], `date DESC LIMIT ${limit}`);
