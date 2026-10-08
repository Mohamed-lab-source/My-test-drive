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
