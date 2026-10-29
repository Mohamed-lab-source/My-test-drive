import type { Task } from '../db/types';

export const ESTIMATE_OPTIONS = [
  { id: '0', label: 'None' },
  { id: '15', label: '15m' },
  { id: '30', label: '30m' },
  { id: '60', label: '1h' },
  { id: '120', label: '2h' },
  { id: '240', label: '4h' },
];

export function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Minutes planned for the open tasks given.
export function plannedMinutes(tasks: Task[]): number {
  return tasks.filter((t) => t.status !== 'done').reduce((sum, t) => sum + (t.estimate_minutes ?? 0), 0);
}

// More than this much estimated work in a day counts as overloaded.
export const DAILY_CAPACITY_MINUTES = 6 * 60;

// ---------- Deadlines ----------
export const DEADLINE_OPTIONS = [
  { id: 'none', label: 'No deadline' },
  { id: '0', label: 'Today' },
  { id: '1', label: 'Tomorrow' },
  { id: '3', label: 'In 3 days' },
  { id: '7', label: 'In a week' },
  { id: '14', label: 'In 2 weeks' },
  { id: '30', label: 'In a month' },
];

export function deadlineFromOption(id: string, now: Date = new Date()): string | null {
  if (id === 'none') return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(id));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whole days from today to a YYYY-MM-DD deadline (negative = overdue).
export function daysToDeadline(key: string, now: Date = new Date()): number {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
}

export function deadlineLabel(key: string, now: Date = new Date()): string {
  const n = daysToDeadline(key, now);
  if (n < 0) return `${-n}d overdue`;
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  return `due in ${n}d`;
}
