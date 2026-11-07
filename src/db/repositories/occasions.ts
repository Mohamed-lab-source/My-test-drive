import { newId, nowIso } from '../client';
import { allRows, deleteRow, getRow, insertRow } from '../helpers';
import type { Occasion } from '../types';

export const listOccasions = () => allRows<Occasion>('occasions', 'month ASC, day ASC');

export async function createOccasion(input: Omit<Occasion, 'id' | 'created_at'>): Promise<Occasion> {
  const id = newId();
  await insertRow('occasions', { id, ...input, created_at: nowIso() });
  return (await getRow<Occasion>('occasions', id))!;
}

export const deleteOccasion = (id: string) => deleteRow('occasions', id);
