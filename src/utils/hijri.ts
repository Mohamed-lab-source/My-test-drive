// Prefers the Umm al-Qura calendar via Intl when the JS engine supports it,
// verified at runtime (an engine without it silently falls back to
// Gregorian), and otherwise uses the tabular arithmetic calendar, which is
// often a day or two off. Either way the user can nudge it with an offset,
// since local moon-sighting (e.g. Egypt's) can differ by a day too.
export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

export interface HijriDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

let intlFormatter: Intl.DateTimeFormat | null | undefined;

function intlHijri(date: Date): HijriDate | null {
  if (intlFormatter === undefined) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
      intlFormatter = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null;
    } catch {
      intlFormatter = null;
    }
  }
  if (!intlFormatter) return null;
  const parts = intlFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value.replace(/\D/g, ''));
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return year > 1300 && month >= 1 && month <= 12 && day >= 1 && day <= 30 ? { year, month, day } : null;
}

export function toHijri(date: Date, offsetDays = 0): HijriDate {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays, 12);
  return intlHijri(shifted) ?? tabularHijri(shifted);
}

function tabularHijri(date: Date): HijriDate {
  const jd = gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 =
    l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

export function formatHijri(date: Date, offsetDays = 0): string {
  const h = toHijri(date, offsetDays);
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} AH`;
}

export interface HijriDay {
  date: Date;
  hijri: HijriDate;
}

// Every Gregorian day in the Hijri month that contains `anchor`, found by
// walking back to day 1 and forward until the month changes.
export function getHijriMonthDays(anchor: Date, offsetDays = 0): HijriDay[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  const month = toHijri(start, offsetDays).month;
  while (toHijri(new Date(start.getTime() - 86400000), offsetDays).month === month) start.setDate(start.getDate() - 1);
  const days: HijriDay[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 31; i++) {
    const hijri = toHijri(cursor, offsetDays);
    if (hijri.month !== month) break;
    days.push({ date: new Date(cursor), hijri });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export type IslamicDayKind = 'eid' | 'fast' | 'season';

// Widely observed days only; the white days (13–15) are marked every month
// except Dhu al-Hijjah, when the 13th is a day of Tashreeq.
export function islamicDay(h: HijriDate): { label: string; kind: IslamicDayKind } | null {
  const { month: m, day: d } = h;
  if (m === 1 && d === 1) return { label: 'Islamic New Year', kind: 'season' };
  if (m === 1 && d === 9) return { label: "Tasu'a", kind: 'fast' };
  if (m === 1 && d === 10) return { label: 'Ashura', kind: 'fast' };
  if (m === 9 && d === 1) return { label: 'Ramadan begins', kind: 'season' };
  if (m === 9 && d >= 21) return { label: 'Last ten nights', kind: 'season' };
  if (m === 10 && d === 1) return { label: 'Eid al-Fitr', kind: 'eid' };
  if (m === 12 && d === 9) return { label: 'Day of Arafah', kind: 'fast' };
  if (m === 12 && d === 10) return { label: 'Eid al-Adha', kind: 'eid' };
  if (m === 12 && d >= 11 && d <= 13) return { label: 'Days of Tashreeq', kind: 'eid' };
  if (m === 12 && d < 9) return { label: 'First ten days', kind: 'season' };
  if (d >= 13 && d <= 15) return { label: 'White days', kind: 'fast' };
  return null;
}

// Upcoming notable days (excluding white days) within `days` of `from`.
export function upcomingIslamicDays(from: Date, days: number, offsetDays = 0): { date: Date; label: string }[] {
  const out: { date: Date; label: string }[] = [];
  let lastLabel = '';
  for (let i = 0; i < days; i++) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
    const info = islamicDay(toHijri(date, offsetDays));
    // Multi-day seasons only list their first day.
    if (info && info.label !== 'White days' && info.label !== lastLabel) out.push({ date, label: info.label });
    lastLabel = info?.label ?? '';
  }
  return out;
}
