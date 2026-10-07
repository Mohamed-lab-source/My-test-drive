/* ======================================================================
 * Jarvis 4.0 — pack 3: Date, time & productivity (offline)
 * Loads after health2.js (reuses c2n / c2r).
 * ====================================================================== */

const d2date = s => { const d = new Date(`${String(s || "").trim()}T12:00:00`); if (isNaN(d)) throw new Error("Use a date like 2026-10-07."); return d; };
const D2_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dateAdd({ date, days, weeks, months, years } = {}) {
  const d = date ? d2date(date) : new Date();
  if (years) d.setFullYear(d.getFullYear() + Math.round(c2n(years, "years")));
  if (months) d.setMonth(d.getMonth() + Math.round(c2n(months, "months")));
  d.setDate(d.getDate() + Math.round(Number(days || 0)) + Math.round(Number(weeks || 0)) * 7);
  return { result: localDayKey(d), weekday: D2_WD[d.getDay()] };
}
function weekdayOf({ date } = {}) { const d = d2date(date); return { date: localDayKey(d), weekday: D2_WD[d.getDay()] }; }
function weekNumber({ date } = {}) {
  const d = d2date(date); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { date: localDayKey(d), isoWeek: Math.ceil(((t - yearStart) / 86400000 + 1) / 7), year: t.getUTCFullYear() };
}
function daysInMonth({ month, year } = {}) {
  const m = Math.round(c2n(month, "the month")), y = Math.round(Number(year) || new Date().getFullYear());
  if (m < 1 || m > 12) throw new Error("Month must be 1–12.");
  return { month: m, year: y, days: new Date(y, m, 0).getDate() };
}
function leapYear({ year } = {}) { const y = Math.round(c2n(year, "a year")); const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return { year: y, leap, februaryDays: leap ? 29 : 28 }; }
function businessDays({ from, to } = {}) {
  let a = d2date(from), b = d2date(to); if (b < a) [a, b] = [b, a];
  let n = 0; const cur = new Date(a);
  while (cur <= b) { const day = cur.getDay(); if (day !== 5 && day !== 6) n++; cur.setDate(cur.getDate() + 1); } // Fri/Sat weekend (Egypt)
  return { from: localDayKey(a), to: localDayKey(b), workingDays: n, note: "Friday & Saturday counted as the weekend." };
}
function addBusinessDays({ date, days } = {}) {
  const d = date ? d2date(date) : new Date(); let n = Math.round(c2n(days, "the number of working days")); const step = n < 0 ? -1 : 1; n = Math.abs(n);
  while (n > 0) { d.setDate(d.getDate() + step); const day = d.getDay(); if (day !== 5 && day !== 6) n--; }
  return { result: localDayKey(d), weekday: D2_WD[d.getDay()] };
}
function nextWeekday({ weekday } = {}) {
  const target = D2_WD.findIndex(w => w.toLowerCase().startsWith(String(weekday || "").toLowerCase().slice(0, 3)));
  if (target < 0) throw new Error("Which weekday?");
  const d = new Date(); let add = (target - d.getDay() + 7) % 7; if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return { weekday: D2_WD[target], date: localDayKey(d), inDays: add };
}
function eventCountdown({ date, time } = {}) {
  const base = String(date || "").trim(); const dt = new Date(`${base}T${/^\d{1,2}:\d{2}/.test(time || "") ? time : "00:00"}:00`);
  if (isNaN(dt)) throw new Error("Give me a date (and optional time).");
  const ms = dt - Date.now(); const past = ms < 0; const s = Math.abs(ms) / 1000;
  return { event: base, days: Math.floor(s / 86400), hours: Math.floor(s % 86400 / 3600), minutes: Math.floor(s % 3600 / 60), direction: past ? "ago" : "to go" };
}
function unixNow() { const now = Date.now(); return { unixSeconds: Math.floor(now / 1000), unixMillis: now, iso: new Date(now).toISOString() }; }
function timestampToDate({ unix } = {}) { let n = c2n(unix, "a timestamp"); if (n < 1e12) n *= 1000; const d = new Date(n); if (isNaN(d)) throw new Error("That timestamp doesn't parse."); return { date: d.toLocaleString("en-GB", { timeZone: "Africa/Cairo" }), iso: d.toISOString() }; }
function dateToTimestamp({ date } = {}) { const d = new Date(`${String(date || "").trim()}T00:00:00`); if (isNaN(d)) throw new Error("Use a date like 2026-10-07."); return { unixSeconds: Math.floor(d.getTime() / 1000), unixMillis: d.getTime() }; }
function durationFormat({ seconds } = {}) {
  let s = Math.round(c2n(seconds, "seconds")); const neg = s < 0; s = Math.abs(s);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  const parts = []; if (d) parts.push(d + "d"); if (h) parts.push(h + "h"); if (m) parts.push(m + "m"); if (sec || !parts.length) parts.push(sec + "s");
  return { seconds: (neg ? -1 : 1) * s, formatted: (neg ? "-" : "") + parts.join(" ") };
}
function timeBetween({ start, end } = {}) {
  const a = h2time(start), b = h2time(end); if (a == null || b == null) throw new Error("Give two times like 9:00 and 17:30.");
  let diff = b - a; if (diff < 0) diff += 1440;
  return { start, end, hours: Math.floor(diff / 60), minutes: diff % 60, totalMinutes: diff };
}
function dayOfYear({ date } = {}) { const d = d2date(date); const start = new Date(d.getFullYear(), 0, 0); return { date: localDayKey(d), dayOfYear: Math.floor((d - start) / 86400000), daysLeft: (leapYear({ year: d.getFullYear() }).leap ? 366 : 365) - Math.floor((d - start) / 86400000) }; }
function daysLeftInYear() { const now = new Date(); const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59); return { daysLeft: Math.ceil((end - now) / 86400000), year: now.getFullYear() }; }
function quarterOf({ date } = {}) { const d = date ? d2date(date) : new Date(); const q = Math.floor(d.getMonth() / 3) + 1; return { date: localDayKey(d), quarter: "Q" + q, year: d.getFullYear() }; }
function seasonOf({ date, hemisphere } = {}) {
  const d = date ? d2date(date) : new Date(); const m = d.getMonth(); const north = !/s(outh)?/i.test(hemisphere || "n");
  let s = m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  if (!north) s = { winter: "summer", spring: "autumn", summer: "winter", autumn: "spring" }[s];
  return { date: localDayKey(d), season: s };
}
function zodiacSign({ date } = {}) {
  const d = d2date(date); const m = d.getMonth() + 1, day = d.getDate();
  const signs = [[1, 20, "Capricorn"], [2, 19, "Aquarius"], [3, 21, "Pisces"], [4, 20, "Aries"], [5, 21, "Taurus"], [6, 21, "Gemini"], [7, 23, "Cancer"], [8, 23, "Leo"], [9, 23, "Virgo"], [10, 23, "Libra"], [11, 22, "Scorpio"], [12, 22, "Sagittarius"], [12, 31, "Capricorn"]];
  const sign = (day < signs[m - 1][1]) ? signs[m - 1][2] : signs[m][2];
  return { date: localDayKey(d), zodiac: sign };
}
const D2_CHINESE = ["Monkey", "Rooster", "Dog", "Pig", "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat"];
function chineseZodiac({ year } = {}) { const y = Math.round(c2n(year, "a year")); return { year: y, animal: D2_CHINESE[y % 12] }; }
function moonPhase({ date } = {}) {
  const d = date ? d2date(date) : new Date(); const ref = Date.UTC(2000, 0, 6, 18, 14); const synodic = 29.53058867;
  let days = (d.getTime() - ref) / 86400000; let age = ((days % synodic) + synodic) % synodic;
  const phases = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  return { date: localDayKey(d), phase: phases[Math.floor((age / synodic) * 8 + 0.5) % 8], illumination: c2r((1 - Math.cos(2 * Math.PI * age / synodic)) / 2 * 100, 0) + "%", moonAgeDays: c2r(age, 1) };
}
function pomodoro({ work, break_minutes, cycles } = {}) {
  const w = Math.round(clampNum(work, 5, 120, 25)), b = Math.round(clampNum(break_minutes, 1, 60, 5)), n = Math.round(clampNum(cycles, 1, 12, 4));
  const longBreak = 15; const total = n * w + (n - 1) * b + longBreak;
  return { work: w, shortBreak: b, cycles: n, totalMinutes: total, finishesIn: durationFormat({ seconds: total * 60 }).formatted, note: `A ${longBreak}-min long break after the set.` };
}
function meetingCost({ people, avg_hourly, minutes } = {}) {
  const p = Math.round(c2n(people, "the number of people")), rate = c2n(avg_hourly, "average hourly cost"), min = c2n(minutes, "minutes");
  return { people: p, minutes: min, cost: c2r(p * rate * min / 60), note: "The real price of that meeting." };
}
const D2_words = v => { if (v && typeof v === "object") return 0; const n = Number(v); if (Number.isFinite(n)) return n; return String(v || "").trim().split(/\s+/).filter(Boolean).length; };
function readingTime({ words, text, wpm } = {}) { const n = text ? D2_words(text) : c2n(words, "a word count"); const rate = clampNum(wpm, 100, 1000, 230); return { words: n, minutes: c2r(n / rate, 1) }; }
function speechTime({ words, text, wpm } = {}) { const n = text ? D2_words(text) : c2n(words, "a word count"); const rate = clampNum(wpm, 80, 220, 130); return { words: n, minutes: c2r(n / rate, 1), note: "At a measured speaking pace." }; }
function typingTime({ words, wpm } = {}) { const n = c2n(words, "a word count"); const rate = clampNum(wpm, 10, 200, 40); return { words: n, minutes: c2r(n / rate, 1) }; }
function timezoneDiff({ city1, city2 } = {}) {
  if (typeof TS_ZONES !== "object") throw new Error("Time-zone data isn't available.");
  const z = c => TS_ZONES[String(c || "").toLowerCase().replace(/[?.]/g, "").trim()];
  const z1 = z(city1), z2 = z(city2 || "cairo"); if (!z1 || !z2) throw new Error("I don't know one of those cities.");
  const now = new Date(); const off = tz => { const s = now.toLocaleString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit" }); return s; };
  const h = (tz) => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", day: "numeric", hour12: false }).formatToParts(now); const g = t => +parts.find(p => p.type === t).value; return g("day") * 1440 + g("hour") * 60 + g("minute"); };
  let diff = (h(z1) - h(z2)) / 60; if (diff > 18) diff -= 24; if (diff < -18) diff += 24;
  return { city1, city2: city2 || "Cairo", hoursDifference: c2r(diff, 1), note: diff === 0 ? "Same time." : `${city1} is ${Math.abs(diff)}h ${diff > 0 ? "ahead of" : "behind"} ${city2 || "Cairo"}.` };
}
function ageInDays({ birthdate } = {}) { const d = d2date(birthdate); return { days: Math.floor((Date.now() - d) / 86400000), weeks: Math.floor((Date.now() - d) / (7 * 86400000)) }; }
function detailedDateDiff({ from, to } = {}) {
  let a = d2date(from), b = to ? d2date(to) : new Date(); if (b < a) [a, b] = [b, a];
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
  if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; }
  return { from: localDayKey(a), to: localDayKey(b), difference: `${y} years, ${m} months, ${d} days`, totalDays: Math.round((b - a) / 86400000) };
}

FEATURE_TOOLS.push(
  xfn("date_add", "Add or subtract days/weeks/months/years to a date (negatives subtract).", { date: xs, days: xn, weeks: xn, months: xn, years: xn }),
  xfn("weekday_of", "Which day of the week a date falls on.", { date: xs }, ["date"]),
  xfn("week_number", "The ISO week number of a date.", { date: xs }, ["date"]),
  xfn("days_in_month", "How many days are in a month.", { month: xi, year: xi }, ["month"]),
  xfn("leap_year", "Is a year a leap year?", { year: xi }, ["year"]),
  xfn("business_days", "Count working days between two dates (Fri/Sat weekend).", { from: xs, to: xs }, ["from", "to"]),
  xfn("add_business_days", "Add working days to a date.", { date: xs, days: xi }, ["days"]),
  xfn("next_weekday", "The date of the next given weekday.", { weekday: xs }, ["weekday"]),
  xfn("event_countdown", "Days/hours/minutes until (or since) a date and time.", { date: xs, time: xs }, ["date"]),
  xfn("unix_now", "The current Unix timestamp.", {}),
  xfn("timestamp_to_date", "Convert a Unix timestamp to a readable date.", { unix: xn }, ["unix"]),
  xfn("date_to_timestamp", "Convert a date to a Unix timestamp.", { date: xs }, ["date"]),
  xfn("duration_format", "Turn a number of seconds into d/h/m/s.", { seconds: xn }, ["seconds"]),
  xfn("time_between", "Hours and minutes between two clock times.", { start: xs, end: xs }, ["start", "end"]),
  xfn("day_of_year", "Which numbered day of the year a date is.", { date: xs }, ["date"]),
  xfn("days_left_in_year", "How many days remain in this year.", {}),
  xfn("quarter_of", "Which calendar quarter a date is in.", { date: xs }),
  xfn("season_of", "The season for a date (hemisphere aware).", { date: xs, hemisphere: xs }),
  xfn("zodiac_sign", "The star sign for a birth date.", { date: xs }, ["date"]),
  xfn("chinese_zodiac", "The Chinese zodiac animal for a year.", { year: xi }, ["year"]),
  xfn("moon_phase", "The moon phase for a date.", { date: xs }),
  xfn("pomodoro", "Plan a Pomodoro study session and its total time.", { work: xi, break_minutes: xi, cycles: xi }),
  xfn("meeting_cost", "What a meeting costs in salary time.", { people: xi, avg_hourly: xn, minutes: xn }, ["people", "avg_hourly", "minutes"]),
  xfn("reading_time", "How long a text (or word count) takes to read.", { words: xn, text: xs, wpm: xi }),
  xfn("speech_time", "How long a speech (or word count) takes to say.", { words: xn, text: xs, wpm: xi }),
  xfn("typing_time", "How long a word count takes to type.", { words: xn, wpm: xi }, ["words"]),
  xfn("timezone_diff", "The time difference between two cities.", { city1: xs, city2: xs }, ["city1"]),
  xfn("age_in_days", "How many days (and weeks) old someone/something is.", { birthdate: xs }, ["birthdate"]),
  xfn("date_difference", "Detailed years/months/days between two dates.", { from: xs, to: xs }, ["from"]),
);
Object.assign(FEATURE_HANDLERS, {
  date_add: a => dateAdd(a), weekday_of: a => weekdayOf(a), week_number: a => weekNumber(a), days_in_month: a => daysInMonth(a),
  leap_year: a => leapYear(a), business_days: a => businessDays(a), add_business_days: a => addBusinessDays(a), next_weekday: a => nextWeekday(a),
  event_countdown: a => eventCountdown(a), unix_now: () => unixNow(), timestamp_to_date: a => timestampToDate(a), date_to_timestamp: a => dateToTimestamp(a),
  duration_format: a => durationFormat(a), time_between: a => timeBetween(a), day_of_year: a => dayOfYear(a), days_left_in_year: () => daysLeftInYear(),
  quarter_of: a => quarterOf(a), season_of: a => seasonOf(a), zodiac_sign: a => zodiacSign(a), chinese_zodiac: a => chineseZodiac(a),
  moon_phase: a => moonPhase(a), pomodoro: a => pomodoro(a), meeting_cost: a => meetingCost(a), reading_time: a => readingTime(a),
  speech_time: a => speechTime(a), typing_time: a => typingTime(a), timezone_diff: a => timezoneDiff(a), age_in_days: a => ageInDays(a),
  date_difference: a => detailedDateDiff(a),
});
TOOL_GROUPS.datetime2 = {
  about: "date & time tools: add/subtract dates, weekdays, week numbers, working days, countdowns, timestamps, durations, seasons, zodiac, moon phase, and productivity timers (Pomodoro, meeting cost, reading/speech time)",
  tools: ["date_add", "weekday_of", "week_number", "days_in_month", "leap_year", "business_days", "add_business_days", "next_weekday", "event_countdown", "unix_now", "timestamp_to_date", "date_to_timestamp", "duration_format", "time_between", "day_of_year", "days_left_in_year", "quarter_of", "season_of", "zodiac_sign", "chinese_zodiac", "moon_phase", "pomodoro", "meeting_cost", "reading_time", "speech_time", "typing_time", "timezone_diff", "age_in_days", "date_difference"],
  match: /\b(add .* days|subtract .* days|what day|day of the week|week number|days in|leap year|working days|business days|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|countdown|how long until|unix|timestamp|duration|hours between|time between|day of (the )?year|days left|quarter|season|zodiac|star sign|chinese zodiac|moon phase|pomodoro|meeting cost|reading time|how long to read|speech time|typing time|time difference|time zone|how many days old|date difference)\b/i,
};

async function initDatetime2() { /* stateless */ }
