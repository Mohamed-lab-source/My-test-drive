/**
 * Tabular (civil) Hijri calendar conversion, via Julian Day Number.
 * Standard arithmetic approximation (Richards, "Mapping Time") used by most
 * non-astronomical Islamic calendar apps -- accurate to within about a day
 * of the actual moon-sighted calendar, which is the best achievable without
 * a live sighting/astronomical data feed.
 */

const ISLAMIC_EPOCH = 1948439.5; // JDN of 1 Muharram, AH 1

function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function islamicToJDN(year: number, month: number, day: number): number {
  return (
    day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + ISLAMIC_EPOCH - 1
  );
}

function jdnToIslamic(jdn: number): { year: number; month: number; day: number } {
  const jd = Math.floor(jdn) + 0.5;
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd - (29 + islamicToJDN(year, 1, 1))) / 29.5) + 1);
  const day = jd - islamicToJDN(year, month, 1) + 1;
  return { year, month, day };
}

export type HijriDate = { year: number; month: number; day: number };

export function gregorianToHijri(date: Date): HijriDate {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return jdnToIslamic(jdn);
}

export function hijriToGregorian(year: number, month: number, day: number): Date {
  const jdn = islamicToJDN(year, month, day);
  const { year: gy, month: gm, day: gd } = jdnToGregorian(Math.round(jdn));
  return new Date(gy, gm - 1, gd);
}

function diffDays(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86400000);
}

export type RamadanStatus =
  | { kind: "ramadan"; dayOfRamadan: number; daysUntilEid: number }
  | { kind: "eid" }
  | { kind: "upcoming"; daysUntilRamadan: number }
  | { kind: "none" };

const UPCOMING_WINDOW_DAYS = 30;
const EID_WINDOW_DAYS = 3;

/** Where "today" sits relative to Ramadan and Eid al-Fitr, for a Home banner. Returns "none" outside the relevant windows so the banner can simply not render most of the year. */
export function getRamadanStatus(today: Date = new Date()): RamadanStatus {
  const hijriToday = gregorianToHijri(today);

  if (hijriToday.month === 9) {
    const eidStart = hijriToGregorian(hijriToday.year, 10, 1);
    return { kind: "ramadan", dayOfRamadan: hijriToday.day, daysUntilEid: diffDays(today, eidStart) };
  }

  if (hijriToday.month === 10 && hijriToday.day <= EID_WINDOW_DAYS) {
    return { kind: "eid" };
  }

  const ramadanYear = hijriToday.month > 9 ? hijriToday.year + 1 : hijriToday.year;
  const ramadanStart = hijriToGregorian(ramadanYear, 9, 1);
  const daysUntilRamadan = diffDays(today, ramadanStart);
  if (daysUntilRamadan >= 0 && daysUntilRamadan <= UPCOMING_WINDOW_DAYS) {
    return { kind: "upcoming", daysUntilRamadan };
  }

  return { kind: "none" };
}
