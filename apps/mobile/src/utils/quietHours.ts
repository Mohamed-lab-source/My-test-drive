export type QuietHours = { enabled: boolean; startHour: number; endHour: number };

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, startHour: 22, endHour: 7 };

// Module-level mirror so the notification schedulers (plain functions, not
// components) can respect quiet hours. Kept in sync by AppSettingsProvider.
let current: QuietHours = DEFAULT_QUIET_HOURS;

export function setQuietHoursMirror(next: QuietHours) {
  current = next;
}

/** True when `date` falls inside the window; windows may wrap past midnight (22 -> 7). */
export function isInQuietHours(date: Date, q: QuietHours = current): boolean {
  if (!q.enabled || q.startHour === q.endHour) return false;
  const h = date.getHours();
  return q.startHour < q.endHour ? h >= q.startHour && h < q.endHour : h >= q.startHour || h < q.endHour;
}

/** Moves a reminder that would ring during quiet hours to the moment they end. */
export function moveOutOfQuietHours(date: Date, q: QuietHours = current): Date {
  if (!isInQuietHours(date, q)) return date;
  const moved = new Date(date);
  // Past midnight of a wrapping window the end is later today; otherwise it's tomorrow.
  if (q.startHour > q.endHour && date.getHours() >= q.startHour) moved.setDate(moved.getDate() + 1);
  moved.setHours(q.endHour, 0, 0, 0);
  return moved;
}

/** Same as moveOutOfQuietHours, for a recurring time of day. */
export function quietAdjustedTime(hour: number, minute: number, q: QuietHours = current): { hour: number; minute: number } {
  const probe = new Date(2000, 0, 1, hour, minute);
  if (!isInQuietHours(probe, q)) return { hour, minute };
  return { hour: q.endHour, minute: 0 };
}
