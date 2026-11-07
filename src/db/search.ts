import { getDb } from './client';
import { formatDateShort } from '../utils/date';
import { formatMoney } from '../utils/money';
import type { Account, Book, Budget, Countdown, Habit, JournalEntry, Meeting, Note, SavingsGoal, ShoppingItem, Task, Transaction, WishlistItem } from './types';

export type SearchResultType =
  | 'transaction'
  | 'task'
  | 'meeting'
  | 'wishlist'
  | 'note'
  | 'book'
  | 'shopping'
  | 'countdown'
  | 'journal'
  | 'account'
  | 'budget'
  | 'habit'
  | 'goal'
  | 'screen'
  | 'setting';
export interface SearchResult {
  // Where tapping it goes, when it has a page of its own.
  route?: string;
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

  // A number like "125.50" or "1,250" also finds transactions of that
  // amount (to the unit), so a bank charge can be found by its price.
  const amount = /^[\d,.]+$/.test(trimmed) ? Number(trimmed.replace(/,/g, '')) : NaN;
  // ">500", "<100" and "100-300" search by amount range too.
  const cmp = trimmed.replace(/,/g, '').match(/^([<>])\s*(\d+(?:\.\d+)?)$/);
  const range = trimmed.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  let amountClause = amount > 0 ? ' OR (amount >= ? AND amount < ?)' : '';
  let amountArgs: number[] = amount > 0 ? [Math.floor(amount) * 100, (Math.floor(amount) + 1) * 100] : [];
  if (cmp) {
    amountClause = cmp[1] === '>' ? ' OR amount > ?' : ' OR amount < ?';
    amountArgs = [Math.round(Number(cmp[2]) * 100)];
  } else if (range) {
    amountClause = ' OR (amount >= ? AND amount <= ?)';
    amountArgs = [Math.round(Number(range[1]) * 100), Math.round(Number(range[2]) * 100)];
  }

  const [transactions, tasks, meetings, wishlist, notes, books, shopping, countdowns, journal] = await Promise.all([
    db.getAllAsync<Transaction>(`SELECT * FROM transactions WHERE note LIKE ?${amountClause} ORDER BY date DESC LIMIT 20`, [like, ...amountArgs]),
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
    db.getAllAsync<JournalEntry>(
      'SELECT * FROM journal_entries WHERE note LIKE ? OR gratitude LIKE ? ORDER BY date DESC LIMIT 20',
      [like, like]
    ),
  ]);
  const [accounts, budgets, habits, goals] = await Promise.all([
    db.getAllAsync<Account>('SELECT * FROM accounts WHERE name LIKE ? OR card_last4 LIKE ? ORDER BY sort_order LIMIT 10', [like, like]),
    db.getAllAsync<Budget>('SELECT * FROM budgets WHERE name LIKE ? OR keywords LIKE ? OR notes LIKE ? LIMIT 10', [like, like, like]),
    db.getAllAsync<Habit>('SELECT * FROM habits WHERE name LIKE ? AND is_archived = 0 LIMIT 10', [like]),
    db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE name LIKE ? LIMIT 10', [like]),
  ]);

  return [
    ...accounts.map((a) => ({
      type: 'account' as const,
      id: a.id,
      title: a.name,
      subtitle: a.type === 'credit' ? `${formatMoney(Math.max(0, -a.balance), a.currency)} owed` : formatMoney(a.balance, a.currency),
      route: `/money/account/${a.id}`,
    })),
    ...budgets.map((b) => ({ type: 'budget' as const, id: b.id, title: b.name || 'Budget', subtitle: `${formatMoney(b.monthly_limit, b.currency)} · ${b.period ?? 'monthly'}` })),
    ...habits.map((h) => ({ type: 'habit' as const, id: h.id, title: h.name, subtitle: 'Habit' })),
    ...goals.map((g) => ({ type: 'goal' as const, id: g.id, title: g.name, subtitle: `${formatMoney(g.current_amount, g.currency)} of ${formatMoney(g.target_amount, g.currency)}` })),
    ...transactions.map((t) => ({
      type: 'transaction' as const,
      id: t.id,
      title: t.note || 'Transaction',
      subtitle: `${formatMoney(t.amount, t.currency)} · ${formatDateShort(t.date)}`,
      // A purchase opens everything spent at that place.
      route: t.note && t.type === 'expense' ? `/money/merchant?name=${encodeURIComponent(t.note.replace(/\s*\([A-Z]{3} [\d.,]+\)$/, '').trim())}` : undefined,
    })),
    ...tasks.map((t) => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.status })),
    ...meetings.map((m) => ({ type: 'meeting' as const, id: m.id, title: m.title, subtitle: m.location ?? undefined })),
    ...wishlist.map((w) => ({ type: 'wishlist' as const, id: w.id, title: w.title })),
    ...notes.map((n) => ({ type: 'note' as const, id: n.id, title: n.body.split('\n')[0], subtitle: 'Note' })),
    ...books.map((b) => ({ type: 'book' as const, id: b.id, title: b.title, subtitle: b.author ?? undefined })),
    ...shopping.map((i) => ({ type: 'shopping' as const, id: i.id, title: i.title, subtitle: i.is_done ? 'In the cart' : 'Shopping list' })),
    ...countdowns.map((c) => ({ type: 'countdown' as const, id: c.id, title: c.title, subtitle: c.date })),
    ...journal.map((j) => ({
      type: 'journal' as const,
      id: j.id,
      title: (j.note || j.gratitude || '').split('\n')[0] || 'Journal entry',
      subtitle: `Journal · ${j.date}`,
    })),
  ];
}
