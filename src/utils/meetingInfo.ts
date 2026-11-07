// A video-call link in a meeting's location or notes, if there is one.
export function meetingLink(m: { location: string | null; notes: string | null }): string | null {
  const text = `${m.location ?? ''} ${m.notes ?? ''}`;
  const match = text.match(/https?:\/\/[^\s)]+/i) ?? text.match(/\b(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s)]+/i);
  if (!match) return null;
  return match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
}

// "Now", "in 25 min", "in 2 h", "tomorrow 9:00"-style countdown to a start
// time (null once it has ended).
export function meetingCountdown(startIso: string, endIso: string | null, now: Date = new Date()): string | null {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : start + 30 * 60000;
  const t = now.getTime();
  if (t >= end) return null;
  if (t >= start) return 'Now';
  const mins = Math.round((start - t) / 60000);
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) return `in ${Math.round(mins / 60)} h`;
  const days = Math.round(mins / (24 * 60));
  return `in ${days} day${days === 1 ? '' : 's'}`;
}
