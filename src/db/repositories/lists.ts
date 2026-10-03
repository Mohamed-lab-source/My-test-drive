import { newId, nowIso } from '../client';
import { allRows, deleteRow, insertRow, updateRow } from '../helpers';
import type { Book, BookStatus, Countdown, Note, Routine, ShoppingItem } from '../types';

// ---------- Shopping list ----------
export const listShoppingItems = () => allRows<ShoppingItem>('shopping_items', 'is_done ASC, created_at DESC');
export async function createShoppingItem(title: string, estAmount: number | null, categoryId: string | null): Promise<void> {
  await insertRow('shopping_items', { id: newId(), title, est_amount: estAmount, category_id: categoryId, is_done: 0, created_at: nowIso() });
}
export const setShoppingDone = (id: string, done: boolean) => updateRow('shopping_items', id, { is_done: done ? 1 : 0 });
export const deleteShoppingItem = (id: string) => deleteRow('shopping_items', id);

// ---------- Routines ----------
export const listRoutines = () => allRows<Routine>('routines', 'created_at ASC');
export async function createRoutine(name: string, items: string[]): Promise<void> {
  await insertRow('routines', { id: newId(), name, items: JSON.stringify(items), created_at: nowIso() });
}
export const deleteRoutine = (id: string) => deleteRow('routines', id);
export function routineItems(r: Routine): string[] {
  try {
    const parsed = JSON.parse(r.items);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ---------- Books ----------
export const listBooks = () => allRows<Book>('books', 'created_at DESC');
export async function createBook(input: { title: string; author: string | null; total_pages: number; status: BookStatus }): Promise<void> {
  await insertRow('books', { id: newId(), ...input, pages_read: 0, finished_at: null, created_at: nowIso() });
}
export const updateBook = (id: string, patch: Partial<Book>) => updateRow('books', id, patch);
export const deleteBook = (id: string) => deleteRow('books', id);

// ---------- Countdowns ----------
export const listCountdowns = () => allRows<Countdown>('countdowns', 'date ASC');
export async function createCountdown(title: string, date: string): Promise<void> {
  await insertRow('countdowns', { id: newId(), title, date, created_at: nowIso() });
}
export const deleteCountdown = (id: string) => deleteRow('countdowns', id);

// ---------- Notes ----------
export const listNotes = () => allRows<Note>('notes', 'pinned DESC, updated_at DESC');
export async function createNote(body: string): Promise<string> {
  const id = newId();
  await insertRow('notes', { id, body, pinned: 0, updated_at: nowIso(), created_at: nowIso() });
  return id;
}
export const updateNote = (id: string, patch: Partial<Pick<Note, 'body' | 'pinned'>>) =>
  updateRow('notes', id, { ...patch, updated_at: nowIso() });
export const deleteNote = (id: string) => deleteRow('notes', id);
