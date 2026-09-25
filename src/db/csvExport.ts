import { allRows } from './helpers';
import type { Account, Category, Transaction } from './types';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportTransactionsCsv(): Promise<string> {
  const [transactions, categories, accounts] = await Promise.all([
    allRows<Transaction>('transactions', 'date DESC'),
    allRows<Category>('categories'),
    allRows<Account>('accounts'),
  ]);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '';
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';

  const header = ['Date', 'Type', 'Amount', 'Currency', 'Account', 'Category', 'Note'];
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    (t.amount / 100).toFixed(2),
    t.currency,
    accountName(t.account_id),
    categoryName(t.category_id),
    t.note ?? '',
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}
