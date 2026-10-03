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

  return { title: titleWords.join(' '), priority, scheduledDate, backlog, projectId, projectName };
}
