import { getDb } from './client';
import type { Meeting, Task, Transaction, WishlistItem } from './types';

export type SearchResultType = 'transaction' | 'task' | 'meeting' | 'wishlist';
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

  const [transactions, tasks, meetings, wishlist] = await Promise.all([
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
  ]);

  return [
    ...transactions.map((t) => ({ type: 'transaction' as const, id: t.id, title: t.note || 'Transaction', subtitle: t.date.slice(0, 10) })),
    ...tasks.map((t) => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.status })),
    ...meetings.map((m) => ({ type: 'meeting' as const, id: m.id, title: m.title, subtitle: m.location ?? undefined })),
    ...wishlist.map((w) => ({ type: 'wishlist' as const, id: w.id, title: w.title })),
  ];
}
