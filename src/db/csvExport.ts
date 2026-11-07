import { allRows } from './helpers';
import type { Account, Category, Project, Task, Transaction } from './types';

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

export async function exportTasksCsv(): Promise<string> {
  const [tasks, projects] = await Promise.all([allRows<Task>('tasks', 'created_at DESC'), allRows<Project>('projects')]);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? '';
  const header = ['Title', 'Status', 'Priority', 'Project', 'Scheduled', 'Deadline', 'Estimate (min)', 'Waiting on', 'Created', 'Completed', 'Notes'];
  const rows = tasks.map((t) => [
    t.title,
    t.status,
    t.priority,
    projectName(t.project_id),
    t.scheduled_date ?? '',
    t.due_date ?? '',
    t.estimate_minutes ?? '',
    t.waiting_on ?? '',
    t.created_at,
    t.completed_at ?? '',
    t.notes ?? '',
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}
