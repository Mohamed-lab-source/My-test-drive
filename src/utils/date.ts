export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeDay(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return target.toLocaleDateString(undefined, { weekday: 'long' });
  return formatDateShort(iso);
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < new Date().setHours(0, 0, 0, 0);
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
}
