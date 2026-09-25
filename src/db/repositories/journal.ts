import { newId, nowIso } from '../client';
import { allRows, insertRow, updateRow, whereRows } from '../helpers';
import type { JournalEntry, JournalMood } from '../types';

export const listJournalEntries = (limit = 30) =>
  allRows<JournalEntry>('journal_entries', `date DESC LIMIT ${limit}`);

export async function setJournalEntry(date: string, mood: JournalMood, note: string | null): Promise<void> {
  const existing = await whereRows<JournalEntry>('journal_entries', 'date = ?', [date]);
  if (existing.length > 0) {
    await updateRow('journal_entries', existing[0].id, { mood, note });
  } else {
    await insertRow('journal_entries', { id: newId(), date, mood, note, created_at: nowIso() });
  }
}
