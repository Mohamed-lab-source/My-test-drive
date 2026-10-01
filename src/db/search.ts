import { getDb } from './client';
import { formatDateShort } from '../utils/date';
import type { Book, Countdown, Meeting, Note, ShoppingItem, Task, Transaction, WishlistItem } from './types';

export type SearchResultType = 'transaction' | 'task' | 'meeting' | 'wishlist' | 'note' | 'book' | 'shopping' | 'countdown';
export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const db = await getDb();
  const like = `%${trimmed}%`;

  const [transactions, tasks, meetings, wishlist, notes, books, shopping, countdowns] = await Promise.all([
    db.getAllAsync<Transaction>('SELECT * FROM transactions WHERE note LIKE ? ORDER BY date DESC LIMIT 20', [like]),
    db.getAllAsync<Task>(
      'SELECT * FROM tasks WHERE title LIKE ? OR notes LIKE ? ORDER BY created_at DESC LIMIT 20',
      [like, like]
    ),
    db.getAllAsync<Meeting>(
      'SELECT * FROM meetings WHERE title LIKE ? OR location LIKE ? ORDER BY start_at DESC LIMIT 20',
      [like, like]
    ),
    db.getAllAsync<WishlistItem>(
      'SELECT * FROM wishlist_items WHERE title LIKE ? OR notes LIKE ? ORDER BY created_at DESC LIMIT 20',
      [like, like]
    ),
    db.getAllAsync<Note>('SELECT * FROM notes WHERE body LIKE ? ORDER BY updated_at DESC LIMIT 20', [like]),
    db.getAllAsync<Book>('SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY created_at DESC LIMIT 20', [like, like]),
    db.getAllAsync<ShoppingItem>('SELECT * FROM shopping_items WHERE title LIKE ? ORDER BY created_at DESC LIMIT 20', [like]),
    db.getAllAsync<Countdown>('SELECT * FROM countdowns WHERE title LIKE ? ORDER BY date ASC LIMIT 20', [like]),
  ]);

  return [
    ...transactions.map((t) => ({ type: 'transaction' as const, id: t.id, title: t.note || 'Transaction', subtitle: formatDateShort(t.date) })),
    ...tasks.map((t) => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.status })),
    ...meetings.map((m) => ({ type: 'meeting' as const, id: m.id, title: m.title, subtitle: m.location ?? undefined })),
    ...wishlist.map((w) => ({ type: 'wishlist' as const, id: w.id, title: w.title })),
    ...notes.map((n) => ({ type: 'note' as const, id: n.id, title: n.body.split('\n')[0], subtitle: 'Note' })),
    ...books.map((b) => ({ type: 'book' as const, id: b.id, title: b.title, subtitle: b.author ?? undefined })),
    ...shopping.map((i) => ({ type: 'shopping' as const, id: i.id, title: i.title, subtitle: i.is_done ? 'In the cart' : 'Shopping list' })),
    ...countdowns.map((c) => ({ type: 'countdown' as const, id: c.id, title: c.title, subtitle: c.date })),
  ];
}
