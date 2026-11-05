import { newId, nowIso } from '../client';
import { allRows, deleteRow, insertRow, updateRow } from '../helpers';

// Small personal lists kept as JSON in one table (see personal_items).
export type PersonalKind = 'gameya' | 'gift' | 'eidiya' | 'payday_step';

export interface PersonalRow {
  id: string;
  kind: PersonalKind;
  data: string;
  updated_at: string;
  created_at: string;
}

export const listPersonalRows = () => allRows<PersonalRow>('personal_items', 'created_at ASC');

export async function createPersonalRow(kind: PersonalKind, data: object): Promise<string> {
  const id = newId();
  await insertRow('personal_items', { id, kind, data: JSON.stringify(data), updated_at: nowIso(), created_at: nowIso() });
  return id;
}

export const updatePersonalRow = (id: string, data: object) => updateRow('personal_items', id, { data: JSON.stringify(data), updated_at: nowIso() });
export const deletePersonalRow = (id: string) => deleteRow('personal_items', id);
