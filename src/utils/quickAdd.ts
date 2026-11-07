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
  // "~30m" / "~1h" / "~1.5h": how long it should take, in minutes.
  estimate: number | null;
  // "@Ahmed": who you're waiting on.
  waitingOn: string | null;
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
  // Numbered, like other to-do apps: 1 is the most important.
  '!1': 'high',
  '!2': 'medium',
  '!3': 'low',
  p1: 'high',
  p2: 'medium',
  p3: 'low',
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// Parts of the day, for "this evening" / "tomorrow morning".
const DAY_PARTS: Record<string, string> = { morning: '09:00', noon: '12:00', afternoon: '15:00', evening: '18:00' };

const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

// "5pm", "5:30pm", "17:30" (but not a bare "5", which is too likely a count).
function parseClock(word: string): string | null {
  const m = word.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/) ?? word.match(/^(\d{1,2}):(\d{2})()$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? hhmm(h, min) : null;
}

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


// Prayer times for a day, so "after Asr" can become a time. Set from the
// app (it knows your city); without it, prayer words stay in the title.
type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
let prayerTimesFor: ((day: Date) => Record<PrayerName, Date> | null) | null = null;
export function setQuickAddPrayerTimes(fn: ((day: Date) => Record<PrayerName, Date> | null) | null): void {
  prayerTimesFor = fn;
}

const PRAYER_WORDS: Record<string, PrayerName> = {
  fajr: 'fajr', fajer: 'fajr', fajir: 'fajr', subh: 'fajr', sobh: 'fajr',
  dhuhr: 'dhuhr', duhr: 'dhuhr', zuhr: 'dhuhr', zohr: 'dhuhr', dhuhur: 'dhuhr', duhur: 'dhuhr', jumuah: 'dhuhr', jummah: 'dhuhr', jumah: 'dhuhr', juma: 'dhuhr',
  asr: 'asr', aser: 'asr',
  maghrib: 'maghrib', magrib: 'maghrib', maghreb: 'maghrib', iftar: 'maghrib',
  isha: 'isha', ishaa: 'isha', esha: 'isha',
  'الفجر': 'fajr', 'الصبح': 'fajr', 'الظهر': 'dhuhr', 'الضهر': 'dhuhr', 'الجمعة': 'dhuhr', 'الجمعه': 'dhuhr', 'العصر': 'asr',
  'المغرب': 'maghrib', 'الفطار': 'maghrib', 'العشا': 'isha', 'العشاء': 'isha',
};

// "after asr", "before maghrib", "at isha", "30m after asr", "بعد العصر".
// Returns the prayer, minutes from its time, and how many words it used.
function prayerAnchor(words: string[], i: number): { prayer: PrayerName; offset: number; used: number } | null {
  const w = (k: number) => words[i + k]?.toLowerCase().replace(/[.,!?]$/, '');
  let k = 0;
  let custom: number | null = null;
  const amount = w(0)?.match(/^(\d+)(m|min|mins|h|hr|hrs)?$/);
  if (amount) {
    const unitWord = amount[2] ?? w(1);
    const unit = unitWord && /^(h|hr|hrs|hour|hours)$/.test(unitWord) ? 60 : unitWord && /^(m|min|mins|minute|minutes)$/.test(unitWord) ? 1 : 0;
    if (!unit) return null;
    custom = Number(amount[1]) * unit;
    k = amount[2] ? 1 : 2;
  }
  const rel = w(k);
  const isAfter = rel === 'after' || rel === 'بعد';
  const isBefore = rel === 'before' || rel === 'قبل';
  const isAt = rel === 'at' || rel === 'by' || rel === 'عند';
  if (!isAfter && !isBefore && !(isAt && custom == null)) return null;
  let p = w(k + 1);
  let used = k + 2;
  // "after the asr" / "after asr prayer" / "after friday prayer".
  if (p === 'the') {
    p = w(k + 2);
    used++;
  }
  if (p === 'friday' && w(used) === 'prayer') {
    p = 'jumuah';
  }
  const prayer = p ? PRAYER_WORDS[p] : undefined;
  if (!prayer) return null;
  if (w(used) === 'prayer' || w(used) === 'salah' || w(used) === 'salat') used++;
  // After praying (about 20 minutes on), half an hour before, or exactly at.
  const offset = isAfter ? custom ?? 20 : isBefore ? -(custom ?? 30) : 0;
  return { prayer, offset, used };
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
  let estimate: number | null = null;
  let waitingOn: string | null = null;
  let prayerAt: { prayer: PrayerName; offset: number } | null = null;

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

    // "after Asr", "before Maghrib", "15m after Isha", "بعد العصر".
    if (prayerTimesFor) {
      const pa = prayerAnchor(words, i);
      if (pa) {
        prayerAt = { prayer: pa.prayer, offset: pa.offset };
        backlog = false;
        i += pa.used - 1;
        continue;
      }
    }

    // "~30m", "~1h", "~1.5h", "~90"
    const est = word.match(/^~(\d+(?:\.\d+)?)(m|min|h|hr)?$/);
    if (est) {
      const n = Number(est[1]);
      estimate = Math.round(est[2] === 'h' || est[2] === 'hr' ? n * 60 : n);
      continue;
    }
    if (word.startsWith('@') && word.length > 1) {
      waitingOn = raw.slice(1).replace(/_/g, ' ');
      continue;
    }
    // "in 3 days", "in 2 weeks"
    if (word === 'in' && next && /^\d+$/.test(next) && /^(day|days|week|weeks)$/.test(words[i + 2]?.toLowerCase() ?? '')) {
      const n = Number(next) * (words[i + 2].toLowerCase().startsWith('week') ? 7 : 1);
      scheduledDate = dateKey(addDays(now, n));
      backlog = false;
      i += 2;
      continue;
    }
    // "next monday": the one in the coming week, never today.
    if (word === 'next' && next && WEEKDAYS[next] !== undefined) {
      scheduledDate = dateKey(addDays(now, (WEEKDAYS[next] - now.getDay() + 7) % 7 || 7));
      backlog = false;
      i++;
      continue;
    }
    // "every friday": weekly, starting on the next Friday.
    if (word === 'every' && next && WEEKDAYS[next] !== undefined) {
      repeat = 'weekly';
      scheduledDate = dateKey(addDays(now, (WEEKDAYS[next] - now.getDay() + 7) % 7));
      backlog = false;
      i++;
      continue;
    }
    if (word === 'weekend' || (word === 'this' && next === 'weekend')) {
      scheduledDate = dateKey(addDays(now, now.getDay() === 6 || now.getDay() === 0 ? 0 : 6 - now.getDay()));
      backlog = false;
      if (word === 'this') i++;
      continue;
    }
    if (word === 'tonight') {
      scheduledDate = dateKey(now);
      backlog = false;
      if (!remindTime) remindTime = '20:00';
      continue;
    }
    // "25/12" or "25-12": that day this year, or next year if it's passed.
    const dm = word.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (dm && Number(dm[1]) <= 31 && Number(dm[2]) >= 1 && Number(dm[2]) <= 12) {
      let d = new Date(now.getFullYear(), Number(dm[2]) - 1, Number(dm[1]));
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear() + 1, Number(dm[2]) - 1, Number(dm[1]));
      scheduledDate = dateKey(d);
      backlog = false;
      continue;
    }

    // Arabic: بكرة / غدا (tomorrow), النهارده / اليوم (today).
    if (word === 'بكرة' || word === 'بكره' || word === 'غدا' || word === 'غداً') {
      scheduledDate = dateKey(addDays(now, 1));
      backlog = false;
      continue;
    }
    if (word === 'النهارده' || word === 'النهاردة' || word === 'اليوم') {
      scheduledDate = dateKey(now);
      backlog = false;
      continue;
    }
    // "in 2 hours", "in 30 min": a reminder later today.
    if (word === 'in' && next && /^\d+$/.test(next) && /^(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/.test(words[i + 2]?.toLowerCase() ?? '')) {
      const unit = words[i + 2].toLowerCase();
      const at = new Date(now.getTime() + Number(next) * (unit.startsWith('h') ? 3600000 : 60000));
      scheduledDate = dateKey(at);
      backlog = false;
      remindTime = hhmm(at.getHours(), at.getMinutes());
      i += 2;
      continue;
    }
    // "this morning/afternoon/evening", "tomorrow morning", "noon".
    if ((word === 'this' || word === 'tomorrow') && next && DAY_PARTS[next]) {
      scheduledDate = dateKey(word === 'tomorrow' ? addDays(now, 1) : now);
      backlog = false;
      remindTime = DAY_PARTS[next];
      i++;
      continue;
    }
    if (word === 'noon' || word === 'midday') {
      remindTime = '12:00';
      continue;
    }
    // "next month": the same day next month.
    if (word === 'next' && next === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()));
      scheduledDate = dateKey(d);
      backlog = false;
      i++;
      continue;
    }
    // "end of month" / "eom": the last day of this month.
    if (word === 'eom' || (word === 'end' && next === 'of' && words[i + 2]?.toLowerCase() === 'month')) {
      scheduledDate = dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      backlog = false;
      if (word === 'end') i += 2;
      continue;
    }
    // "dec 25", "25 dec", "december 25": that day, next year if it's passed.
    const monA = MONTHS[word];
    const monB = next ? MONTHS[next] : undefined;
    const dayNum = (w: string | undefined) => (w && /^\d{1,2}(st|nd|rd|th)?$/.test(w) ? Number(w.replace(/\D/g, '')) : null);
    if ((monA !== undefined && dayNum(next)) || (dayNum(word) && monB !== undefined)) {
      const month = monA !== undefined ? monA : monB!;
      const day = monA !== undefined ? dayNum(next)! : dayNum(word)!;
      if (day >= 1 && day <= 31) {
        let d = new Date(now.getFullYear(), month, day);
        if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear() + 1, month, day);
        scheduledDate = dateKey(d);
        backlog = false;
        i++;
        continue;
      }
    }
    // A bare clock time: "call bank 5pm".
    const clock = parseClock(word);
    if (clock) {
      remindTime = clock;
      continue;
    }

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
      // After "tonight", any bare hour is in the evening.
      if (!m[3] && h >= 1 && h < 12 && /\btonight\b/i.test(text)) h += 12;
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
    if (word === 'tomorrow' || word === 'tmrw' || word === 'tmr' || word === 'tmw') {
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

  // A prayer time on the chosen day; if it has already passed today (and
  // no other day was given), the same prayer tomorrow.
  if (prayerAt && prayerTimesFor) {
    const resolve = (key: string) => {
      const [y, m, d] = key.split('-').map(Number);
      const times = prayerTimesFor!(new Date(y, m - 1, d));
      return times ? new Date(times[prayerAt!.prayer].getTime() + prayerAt!.offset * 60000) : null;
    };
    let key = scheduledDate ?? dateKey(now);
    let at = resolve(key);
    if (at && key === dateKey(now) && at.getTime() <= now.getTime()) {
      key = dateKey(addDays(now, 1));
      at = resolve(key);
    }
    if (at) {
      scheduledDate = key;
      remindTime = hhmm(at.getHours(), at.getMinutes());
    }
  }

  return { title: titleWords.join(' '), priority, scheduledDate, backlog, projectId, projectName, remindTime, repeat, deadline, estimate, waitingOn };
}
