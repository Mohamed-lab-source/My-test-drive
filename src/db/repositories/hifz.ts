import { nowIso } from '../client';
import { allRows, deleteRow, getRow, insertRow, updateRow } from '../helpers';
import type { HifzEntry } from '../types';

export const listHifz = () => allRows<HifzEntry>('hifz', 'surah ASC');

// One row per surah (id "s<number>"); clearing the status deletes it.
export async function setHifzStatus(surah: number, status: HifzEntry['status'] | null): Promise<void> {
  const id = `s${surah}`;
  const existing = await getRow<HifzEntry>('hifz', id);
  if (!status) {
    if (existing) await deleteRow('hifz', id);
    return;
  }
  if (existing) await updateRow('hifz', id, { status, updated_at: nowIso() });
  else await insertRow('hifz', { id, surah, status, updated_at: nowIso() });
}
