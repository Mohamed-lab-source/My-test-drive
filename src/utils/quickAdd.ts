// Parses a one-line task like "Call mom tomorrow !high #family" into its
// parts. Only whole words are treated as keywords, so "today's" or
// "fridays" stay part of the title.
export type QuickPriority = 'low' | 'medium' | 'high';

export interface ParsedTask {
  title: string;
  priority: QuickPriority;
  scheduledDate: string | null;
  backlog: boolean;
  projectId: string | null;
  projectName: string | null;
  // "at 5pm" / "at 17:30": a reminder time (HH:MM, 24h) on the scheduled day.
  remindTime: string | null;
  // "every day/week/month" or "daily/weekly/monthly".
  repeat: 'daily' | 'weekly' | 'monthly' | null;
  // "by friday" / "by tomorrow" / "due next week": a deadline (YYYY-MM-DD).
  deadline: string | null;
}

const PRIORITY_TOKENS: Record<string, QuickPriority> = {
  '!high': 'high',
  '!h': 'high',
  '!!!': 'high',
  '!medium': 'medium',
  '!med': 'medium',
  '!m': 'medium',
  '!!': 'medium',
  '!low': 'low',
  '!l': 'low',
};

// Weekday word → JS getDay() index (0 = Sunday).
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

export function parseQuickTask(
  text: string,
  projects: { id: string; name: string }[],
  now: Date = new Date()
): ParsedTask {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const titleWords: string[] = [];
  let priority: QuickPriority = 'medium';
  let scheduledDate: string | null = dateKey(now);
  let backlog = false;
  let projectId: string | null = null;
  let projectName: string | null = null;
  let remindTime: string | null = null;
  let repeat: ParsedTask['repeat'] = null;
  let deadline: string | null = null;

  // A day word, as used after "by"/"due": today, tomorrow, a weekday, "next week".
  const dayFrom = (w: string | undefined, w2: string | undefined): { key: string; used: number } | null => {
    if (!w) return null;
    if (w === 'today' || w === 'tonight') return { key: dateKey(now), used: 1 };
    if (w === 'tomorrow' || w === 'tmrw' || w === 'tmr') return { key: dateKey(addDays(now, 1)), used: 1 };
    if (w === 'next' && w2 === 'week') return { key: dateKey(addDays(now, 7)), used: 2 };
    const d = WEEKDAYS[w];
    if (d !== undefined) return { key: dateKey(addDays(now, (d - now.getDay() + 7) % 7 || 7)), used: 1 };
    return null;
  };

  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const word = raw.toLowerCase();
    const next = words[i + 1]?.toLowerCase();

    if (PRIORITY_TOKENS[word]) {
      priority = PRIORITY_TOKENS[word];
      continue;
    }
    if (word.startsWith('#') && word.length > 1) {
      const needle = word.slice(1);
      const match = projects.find((p) => p.name.toLowerCase().replace(/\s+/g, '').startsWith(needle));
      if (match) {
        projectId = match.id;
        projectName = match.name;
        continue;
      }
    }
    // "at 5", "at 5pm", "at 5:30pm", "at 17:30"
    if (word === 'at' && next && /^\d{1,2}(:\d{2})?(am|pm)?$/.test(next)) {
      const m = next.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)!;
      let h = Number(m[1]);
      const min = Number(m[2] ?? 0);
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      // A bare "at 5" in the afternoon/evening range means 5 PM.
      if (!m[3] && h >= 1 && h <= 7) h += 12;
      if (h < 24 && min < 60) {
        remindTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        i++;
        continue;
      }
    }
    if (word === 'every' && (next === 'day' || next === 'week' || next === 'month')) {
      repeat = next === 'day' ? 'daily' : next === 'week' ? 'weekly' : 'monthly';
      i++;
      continue;
    }
    if (word === 'daily' || word === 'weekly' || word === 'monthly') {
      repeat = word;
      continue;
    }
    if (word === 'by' || word === 'due') {
      const d = dayFrom(next, words[i + 2]?.toLowerCase());
      if (d) {
        deadline = d.key;
        i += d.used;
        continue;
      }
    }
    if (word === 'today' || word === 'tod') {
      scheduledDate = dateKey(now);
      backlog = false;
      continue;
    }
    if (word === 'tomorrow' || word === 'tmrw' || word === 'tmr') {
      scheduledDate = dateKey(addDays(now, 1));
      backlog = false;
      continue;
    }
    if (word === 'next' && next === 'week') {
      scheduledDate = dateKey(addDays(now, 7));
      backlog = false;
      i++;
      continue;
    }
    if (word === 'someday' || word === 'backlog' || word === 'later') {
      scheduledDate = null;
      backlog = true;
      continue;
    }
    const dayIdx = WEEKDAYS[word];
    if (dayIdx !== undefined) {
      // Same weekday as today means today; otherwise the next one ahead.
      scheduledDate = dateKey(addDays(now, (dayIdx - now.getDay() + 7) % 7));
      backlog = false;
      continue;
    }
    titleWords.push(raw);
  }

  return { title: titleWords.join(' '), priority, scheduledDate, backlog, projectId, projectName, remindTime, repeat, deadline };
}
