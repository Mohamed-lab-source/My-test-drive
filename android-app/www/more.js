/* ======================================================================
 * Jarvis 2.7 — ten more abilities
 *
 * Football, gold, Qur'an, Hijri calendar, screen time, evening debrief,
 * leave-by alerts, sleep tracking, contact birthdays, ringer & brightness.
 * Loads after places.js.
 * ====================================================================== */

Object.assign(state, {
  sleepLog: [],        // [{bed, wake, minutes}]
  bedAt: null,         // set by the goodnight protocol
  debrief: { enabled: false, time: "21:30" },
});

/* 1. Football ---------------------------------------------------------------- */
const LEAGUES = {
  "egy.1": "Egyptian Premier League", "eng.1": "Premier League", "esp.1": "La Liga", "ita.1": "Serie A",
  "ger.1": "Bundesliga", "fra.1": "Ligue 1", "uefa.champions": "Champions League", "uefa.europa": "Europa League",
  "caf.champions": "CAF Champions League", "ksa.1": "Saudi Pro League",
};
const LEAGUE_WORDS = [
  [/egypt|egyptian|الدوري المصري/i, "egy.1"], [/premier|english|epl/i, "eng.1"], [/la ?liga|spanish|spain/i, "esp.1"],
  [/serie a|italian|italy/i, "ita.1"], [/bundesliga|german/i, "ger.1"], [/ligue 1|french/i, "fra.1"],
  [/caf|african/i, "caf.champions"], [/champions|ucl|الأبطال/i, "uefa.champions"], [/europa/i, "uefa.europa"],
  [/saudi|roshn/i, "ksa.1"],
];
const TEAM_ALIASES = [[/الأهلي|الاهلي|ahly/i, "ahly"], [/الزمالك|zamalek/i, "zamalek"], [/بيراميدز|pyramids/i, "pyramids"], [/المصري|al masry/i, "masry"], [/ليفربول/i, "liverpool"], [/ريال مدريد|real madrid/i, "real madrid"], [/برشلونة/i, "barcelona"]];

const espnDay = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

async function espnScoreboard(league, from, to) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;
  let data;
  try { data = await httpGetJson(`${base}?dates=${espnDay(from)}-${espnDay(to)}&limit=200`); }
  catch { data = await httpGetJson(base); }
  return (data.events || []).map(ev => {
    const comp = (ev.competitions || [])[0] || {};
    const teams = (comp.competitors || []).map(c => ({ name: c.team && (c.team.displayName || c.team.name), score: c.score, home: c.homeAway === "home" }));
    const home = teams.find(t => t.home) || teams[0] || {};
    const away = teams.find(t => !t.home) || teams[1] || {};
    const st = (ev.status && ev.status.type) || {};
    return {
      league: LEAGUES[league] || league,
      date: ev.date,
      when: new Date(ev.date).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      match: `${home.name} vs ${away.name}`,
      score: st.state === "pre" ? null : `${home.score}-${away.score}`,
      status: st.state === "pre" ? "upcoming" : st.state === "in" ? `live ${ev.status.displayClock || ""}`.trim() : (st.shortDetail || "full time"),
    };
  });
}

async function footballScores({ team, league } = {}) {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000);
  const to = new Date(now.getTime() + 10 * 86400000);
  let teamKey = team ? String(team).toLowerCase().trim() : "";
  for (const [re, key] of TEAM_ALIASES) if (re.test(teamKey)) teamKey = key;
  let leagues = [];
  if (league) {
    const hit = LEAGUE_WORDS.find(([re]) => re.test(league));
    leagues = [hit ? hit[1] : String(league)];
  } else {
    leagues = teamKey ? ["egy.1", "caf.champions", "eng.1", "esp.1", "uefa.champions", "ita.1", "ger.1", "fra.1", "ksa.1"] : ["egy.1"];
  }
  const results = await Promise.allSettled(leagues.map(l => espnScoreboard(l, from, to)));
  let matches = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  if (teamKey) matches = matches.filter(m => m.match.toLowerCase().includes(teamKey));
  if (!matches.length) {
    if (results.every(r => r.status === "rejected")) throw new Error("The scores service didn't answer. Try again shortly.");
    return { found: false, note: `No matches for ${team || league || "that"} in the last week or the next ten days.` };
  }
  matches.sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = matches.filter(m => m.status !== "upcoming").slice(-5);
  const upcoming = matches.filter(m => m.status === "upcoming").slice(0, 5);
  return { recentAndLive: past.map(({ date, ...m }) => m), upcoming: upcoming.map(({ date, ...m }) => m), source: "ESPN" };
}

/* 2. Gold prices (EGP) -------------------------------------------------------- */
const OUNCE_G = 31.1034768;
async function goldPrice({ currency } = {}) {
  const cur = String(currency || state.currency || "EGP").toUpperCase();
  let ounce = null, change = null, source = "";
  try {
    const j = await httpGetJson(`https://data-asg.goldprice.org/dbXRates/${cur}`);
    const it = j.items && j.items[0];
    if (it && it.xauPrice) { ounce = it.xauPrice; change = it.pcXau; source = "goldprice.org"; }
  } catch {}
  if (!ounce) {
    const y = await httpGetJson("https://query1.finance.yahoo.com/v8/finance/chart/GC=F");
    const usd = y.chart.result[0].meta.regularMarketPrice;
    let rate = 1;
    if (cur !== "USD") {
      const fx = await httpGetJson("https://open.er-api.com/v6/latest/USD");
      rate = fx.rates[cur];
      if (!rate) throw new Error(`No exchange rate for ${cur}.`);
    }
    ounce = usd * rate;
    source = "COMEX gold futures × exchange rate";
  }
  const gram24 = ounce / OUNCE_G;
  const r = v => Math.round(v);
  return {
    currency: cur,
    perGram: { "24k": r(gram24), "21k": r(gram24 * 0.875), "18k": r(gram24 * 0.75) },
    perOunce: r(ounce),
    changeTodayPct: change !== null ? Math.round(change * 100) / 100 : undefined,
    note: "International spot price converted. Egyptian shop prices differ (workmanship, local premium).",
    source,
  };
}

/* 3. The Qur'an -------------------------------------------------------------- */
let surahList = null;
let recitation = null;

async function surahs() {
  if (!surahList) surahList = (await httpGetJson("https://api.alquran.cloud/v1/surah")).data;
  return surahList;
}
const normSurah = s => String(s).toLowerCase().replace(/^(surah|sura|surat|سورة)\s+/i, "").replace(/^(al|an|ar|as|at|ad|az|ash|adh)[-\s']*/i, "").replace(/[^a-z0-9؀-ۿ]/g, "");

async function findSurah(q) {
  const n = Number(q);
  const list = await surahs();
  if (Number.isInteger(n) && n >= 1 && n <= 114) return list[n - 1];
  const key = normSurah(q);
  return list.find(s => normSurah(s.englishName) === key || normSurah(s.name) === key || normSurah(s.englishNameTranslation) === key)
    || list.find(s => normSurah(s.englishName).startsWith(key) || key.startsWith(normSurah(s.englishName)));
}

function stopRecitation() {
  if (recitation) { recitation.pause(); recitation = null; }
}

async function quran({ surah, ayah, recite } = {}) {
  const s = await findSurah(surah || 1);
  if (!s) throw new Error(`I couldn't find a surah called "${surah}".`);
  const out = { surah: `${s.englishName} (${s.name}), ${s.englishNameTranslation}`, number: s.number, ayahs: s.numberOfAyahs };
  if (ayah) {
    const a = Math.max(1, Math.min(s.numberOfAyahs, Number(ayah)));
    const j = await httpGetJson(`https://api.alquran.cloud/v1/ayah/${s.number}:${a}/editions/quran-uthmani,en.sahih`);
    out.ayah = a;
    out.arabic = j.data[0].text;
    out.meaning = j.data[1].text;
    out.audio = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${j.data[0].number}.mp3`;
  }
  if (recite) {
    stopRecitation();
    const url = out.audio || `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${s.number}.mp3`;
    recitation = new Audio(url);
    recitation.onended = () => { recitation = null; };
    // Don't let the microphone pick up the recitation as speech: end the voice conversation.
    conversationActive = false;
    try { await SpeechRecognition.stop(); } catch {}
    setTimeout(() => { if (recitation) recitation.play().catch(e => toast("Couldn't play the recitation: " + e.message)); }, 600);
    out.reciting = "Mishary Alafasy";
    out.note = "Playing now. A tap on the core stops it.";
  }
  delete out.audio;
  return out;
}

/* 4. Hijri calendar ------------------------------------------------------------ */
const OCCASIONS = [
  ["Islamic New Year", 1, 1], ["Mawlid an-Nabi", 12, 3], ["Ramadan", 1, 9],
  ["Eid al-Fitr", 1, 10], ["Day of Arafah", 9, 12], ["Eid al-Adha", 10, 12],
];
const dmy = d => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;

async function hijriDate({ date, occasion } = {}) {
  const day = date ? new Date(`${date}T12:00:00`) : new Date();
  const h = (await httpGetJson(`https://api.aladhan.com/v1/gToH/${dmy(day)}`)).data.hijri;
  const out = { gregorian: localDayKey(day), hijri: `${h.day} ${h.month.en} ${h.year} AH`, hijriArabic: `${h.day} ${h.month.ar} ${h.year}` };
  const wanted = occasion ? OCCASIONS.filter(([name]) => name.toLowerCase().includes(String(occasion).toLowerCase().replace(/^eid /, "eid "))) : OCCASIONS;
  const list = wanted.length ? wanted : OCCASIONS;
  const today = startOfDay();
  const year = Number(h.year);
  const lookups = list.flatMap(([name, d, m]) => [year, year + 1].map(y => ({ name, d, m, y })));
  const dates = await Promise.allSettled(lookups.map(async x => {
    const g = (await httpGetJson(`https://api.aladhan.com/v1/hToG/${pad2(x.d)}-${pad2(x.m)}-${x.y}`)).data.gregorian.date;
    const [dd, mm, yy] = g.split("-").map(Number);
    return { name: x.name, date: new Date(yy, mm - 1, dd) };
  }));
  const next = {};
  for (const r of dates) {
    if (r.status !== "fulfilled" || r.value.date < today) continue;
    const { name, date: d } = r.value;
    if (!next[name] || d < next[name]) next[name] = d;
  }
  out.upcoming = Object.entries(next).sort((a, b) => a[1] - b[1]).map(([name, d]) => ({
    occasion: name, date: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    inDays: Math.round((d - today) / 86400000),
  }));
  out.note = "Calculated dates; the official start can shift a day with the moon sighting.";
  return out;
}

/* 5. Screen time ---------------------------------------------------------------- */
async function screenTime({ period = "today", app } = {}) {
  const now = new Date();
  let start = startOfDay(now), end = now;
  if (period === "yesterday") { end = startOfDay(now); start = new Date(end.getTime() - 86400000); }
  if (period === "week") start = new Date(startOfDay(now).getTime() - 6 * 86400000);
  let r;
  try { r = await DeviceActions.getAppUsage({ start: start.getTime(), end: end.getTime() }); }
  catch (e) {
    if (String(e.message).includes("NO_ACCESS")) {
      DeviceActions.openUsageAccessSettings().catch(() => {});
      throw new Error("I need usage access to see screen time. I've opened the setting: find Jarvis and switch it on, then ask again.");
    }
    throw e;
  }
  const hm = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  let apps = r.apps.map(a => ({ app: a.app, time: hm(a.minutes), minutes: a.minutes, opens: a.opens }));
  if (app) {
    const q = String(app).toLowerCase();
    apps = apps.filter(a => a.app.toLowerCase().includes(q));
    if (!apps.length) return { period, app, time: "0m", note: `No ${app} use found for ${period}.` };
  }
  return { period, total: hm(r.totalMinutes), apps: apps.slice(0, 8) };
}

/* 6. Sleep (logged by the goodnight / good-morning protocols) -------------------- */
const extrasRunRoutine = runRoutine;
runRoutine = async function (args = {}) {
  const out = await extrasRunRoutine(args);
  if (out.routine === "goodnight") {
    state.bedAt = Date.now();
    store.set("bedAt", state.bedAt);
  } else if (out.routine === "good morning" && state.bedAt && Date.now() - state.bedAt < 16 * 3600e3) {
    const minutes = Math.round((Date.now() - state.bedAt) / 60000);
    if (minutes >= 60) {
      state.sleepLog.push({ bed: state.bedAt, wake: Date.now(), minutes });
      state.sleepLog = state.sleepLog.slice(-120);
      store.set("sleepLog", state.sleepLog);
      out.sleptLastNight = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    state.bedAt = null;
    store.set("bedAt", null);
  }
  return out;
};

function sleepReport({ days = 7 } = {}) {
  const since = Date.now() - clampNum(days, 1, 60, 7) * 86400000;
  const nights = state.sleepLog.filter(n => n.wake >= since);
  if (!nights.length) return { nights: 0, note: 'No sleep logged yet. Say "goodnight" at bedtime and "good morning" when you get up.' };
  const hm = m => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const avg = nights.reduce((s, n) => s + n.minutes, 0) / nights.length;
  const bedMins = nights.map(n => { const d = new Date(n.bed); let m = d.getHours() * 60 + d.getMinutes(); if (m < 12 * 60) m += 1440; return m; });
  const avgBed = bedMins.reduce((a, b) => a + b, 0) / bedMins.length;
  const last = nights[nights.length - 1];
  return {
    nights: nights.length,
    average: hm(avg),
    lastNight: hm(last.minutes),
    typicalBedtime: `${pad2(Math.floor(avgBed / 60) % 24)}:${pad2(Math.round(avgBed % 60))}`,
    shortestNight: hm(Math.min(...nights.map(n => n.minutes))),
  };
}

/* 7. Evening debrief -------------------------------------------------------------- */
const DEBRIEF_ID = 990002;

async function eveningDebrief() {
  const today = localDayKey();
  const out = {};
  out.didToday = state.activityLog.filter(a => localDayKey(new Date(a.at)) === today).slice(0, 12).map(a => a.label);
  const spent = expenseReport({ period: "today" });
  out.spentToday = spent.totals;
  out.habits = Object.keys(state.habits).map(k => { const s = habitStats(k); return `${k}: ${s.doneToday ? "done" : "not yet"} (streak ${s.streakDays})`; });
  const tomorrow = new Date(startOfDay().getTime() + 86400000);
  out.tomorrowReminders = state.reminders.filter(r => !r.done && r.time && localDayKey(new Date(r.time)) === localDayKey(tomorrow)).map(r => r.text);
  const jobs = [];
  if (state.calendarRefreshToken) jobs.push(listEvents(localDayKey(tomorrow), 1).then(e => { out.tomorrowEvents = e; }));
  if (state.homeLoc || state.places.home) jobs.push(getForecast(undefined, 2).then(f => { out.tomorrowWeather = f.daily[1]; }));
  await Promise.allSettled(jobs);
  const soon = listImportantDates().dates.filter(d => d.daysUntil <= 2);
  if (soon.length) out.comingUp = soon;
  return out;
}

async function scheduleDebrief() {
  try { await LocalNotifications.cancel({ notifications: [{ id: DEBRIEF_ID }] }); } catch {}
  if (!state.debrief.enabled || !(await ensureNotifyPermission())) return;
  const [hour, minute] = String(state.debrief.time || "21:30").split(":").map(Number);
  await LocalNotifications.schedule({ notifications: [{
    id: DEBRIEF_ID, title: "Evening debrief", body: `Your day, wrapped up, ${state.address}. Tap to hear it.`,
    schedule: { on: { hour, minute }, allowWhileIdle: true }, extra: { action: "debrief" },
  }] });
}

/* 8. Leave-by alerts for calendar events with a location --------------------------- */
const LEAVE_ID_BASE = 210000;
const travelCache = new Map(); // "location" -> minutes

async function quietPosition() {
  // Never prompt: use GPS only if already allowed, else the saved home.
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location === "granted" || perm.coarseLocation === "granted") {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 15 * 60000, timeout: 8000 });
      return { lat: p.coords.latitude, lon: p.coords.longitude };
    }
  } catch {}
  return state.places.home || null;
}

async function scheduleLeaveAlerts(events) {
  const now = Date.now();
  const withPlace = events.filter(e => e.location && e.start && e.start.includes("T") && new Date(e.start) - now > 20 * 60000).slice(0, 5);
  try { await LocalNotifications.cancel({ notifications: [0, 1, 2, 3, 4].map(i => ({ id: LEAVE_ID_BASE + i })) }); } catch {}
  if (!withPlace.length || !state.meetingAlerts) return;
  const from = await quietPosition();
  if (!from) return;
  const notifications = [];
  for (const [i, e] of withPlace.entries()) {
    try {
      let minutes = travelCache.get(e.location);
      if (minutes === undefined) {
        const to = await geocode(e.location);
        const route = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`)).json();
        minutes = Math.round(route.routes[0].duration / 60);
        travelCache.set(e.location, minutes);
      }
      const buffered = Math.round(minutes * 1.4) + 10; // Cairo traffic and parking
      const leaveAt = new Date(new Date(e.start).getTime() - buffered * 60000);
      if (leaveAt.getTime() > now + 60000) {
        notifications.push({
          id: LEAVE_ID_BASE + i, title: "Time to leave",
          body: `Leave now for ${e.title}, ${state.address}: about ${minutes} min drive plus traffic.`,
          schedule: { at: leaveAt, allowWhileIdle: true },
        });
      }
    } catch {}
  }
  if (notifications.length && await ensureNotifyPermission()) await LocalNotifications.schedule({ notifications });
}

const presenceScheduleMeetingAlerts = scheduleMeetingAlerts;
scheduleMeetingAlerts = async function (events) {
  await presenceScheduleMeetingAlerts(events);
  scheduleLeaveAlerts(events).catch(e => console.warn("leave alerts", e));
};

/* 9. Birthdays from contacts -------------------------------------------------------- */
async function importContactBirthdays() {
  if (!(await ensureContactsPermission())) throw new Error("Contacts permission is off.");
  const { contacts } = await Contacts.getContacts({ projection: { name: true, birthday: true } });
  const known = new Set(state.importantDates.map(d => d.label.toLowerCase()));
  const added = [];
  for (const c of contacts || []) {
    const b = c.birthday;
    const name = contactDisplay(c);
    if (!b || !b.month || !b.day || !name) continue;
    const label = `${name}'s birthday`;
    if (known.has(label.toLowerCase())) continue;
    state.importantDates.push({ id: makeId(), label, month: Number(b.month), day: Number(b.day), year: b.year ? Number(b.year) : null });
    known.add(label.toLowerCase());
    added.push(label);
  }
  if (added.length) saveDates();
  return { imported: added.length, names: added.slice(0, 15), note: added.length ? "Reminders are set for the evening before and the morning of each." : "No new birthdays found in your contacts." };
}

/* 10. Ringer & brightness ------------------------------------------------------------ */
async function setRinger({ mode }) {
  try { return await DeviceActions.setRingerMode({ mode }); }
  catch (e) {
    if (String(e.message).includes("NO_POLICY_ACCESS")) throw new Error("Android needs Do Not Disturb access for that. I've opened the setting: allow Jarvis, then ask again.");
    throw e;
  }
}
async function setScreenBrightness({ percent, auto }) {
  try { return await DeviceActions.setBrightness({ percent: clampNum(percent, 1, 100, 50), auto: !!auto }); }
  catch (e) {
    if (String(e.message).includes("NO_WRITE_SETTINGS")) throw new Error("Android needs 'Modify system settings' permission for brightness. I've opened it: allow Jarvis, then ask again.");
    throw e;
  }
}

/* Tools ---------------------------------------------------------------------------------- */
FEATURE_TOOLS.push(
  xfn("football_scores", "Football results, live scores and upcoming fixtures for a team (Al Ahly, Zamalek, Liverpool…) or a league (Egyptian, Premier League, Champions League…).", { team: xs, league: xs }),
  xfn("gold_price", "Current gold price per gram (24k, 21k, 18k) and per ounce, in the user's currency.", { currency: xs }),
  xfn("quran", "The Qur'an: surah info, a specific ayah in Arabic with its English meaning, and/or play a recitation (Mishary Alafasy).", { surah: { type: "string", description: "Name or number, e.g. Al-Kahf or 18" }, ayah: { type: "integer" }, recite: { type: "boolean" } }, ["surah"]),
  xfn("hijri_date", "Today's (or a date's) Hijri date, and how many days until Ramadan, the Eids and other occasions.", { date: { type: "string", description: "YYYY-MM-DD" }, occasion: xs }),
  xfn("screen_time", "How long the user spent on their phone and on which apps.", { period: { type: "string", enum: ["today", "yesterday", "week"] }, app: xs }),
  xfn("sleep_report", "Sleep logged via the goodnight / good-morning protocols: last night, average, typical bedtime.", { days: { type: "integer" } }),
  xfn("evening_debrief", "Wrap up the user's day: what Jarvis did, spending, habits, and tomorrow's events, reminders and weather."),
  xfn("debrief_schedule", "Turn the nightly debrief notification on or off, optionally at a time.", { on: { type: "boolean" }, time: { type: "string", description: "HH:MM" } }, ["on"]),
  xfn("import_contact_birthdays", "Import birthdays saved in the phone's contacts into important dates (yearly reminders)."),
  xfn("set_ringer", "Set the phone's ringer: normal, vibrate or silent.", { mode: { type: "string", enum: ["normal", "vibrate", "silent"] } }, ["mode"]),
  xfn("set_brightness", "Set screen brightness (1-100) or switch to automatic.", { percent: { type: "integer" }, auto: { type: "boolean" } }),
);
Object.assign(FEATURE_HANDLERS, {
  football_scores: a => footballScores(a),
  gold_price: a => goldPrice(a),
  quran: a => quran(a),
  hijri_date: a => hijriDate(a),
  screen_time: a => screenTime(a),
  sleep_report: a => sleepReport(a),
  evening_debrief: () => eveningDebrief(),
  debrief_schedule: async a => {
    state.debrief = { enabled: !!a.on, time: /^\d{1,2}:\d{2}$/.test(a.time || "") ? a.time : state.debrief.time };
    store.set("debrief", state.debrief);
    syncDebriefControls();
    await scheduleDebrief();
    return { debrief: state.debrief.enabled ? `on at ${state.debrief.time}` : "off" };
  },
  import_contact_birthdays: () => importContactBirthdays(),
  set_ringer: a => setRinger(a),
  set_brightness: a => setScreenBrightness(a),
});
Object.assign(FEATURE_LABELS, {
  football_scores: a => `CHECKING FIXTURES${a.team ? ": " + a.team : a.league ? ": " + a.league : ""}`,
  gold_price: () => "CHECKING GOLD",
  quran: a => a.recite ? "RECITATION" : `QUR'AN: ${a.surah || ""}${a.ayah ? " " + a.ayah : ""}`,
  hijri_date: () => "CONSULTING THE HIJRI CALENDAR",
  screen_time: a => `SCREEN TIME: ${a.period || "today"}`,
  sleep_report: () => "REVIEWING SLEEP",
  evening_debrief: () => "COMPILING DEBRIEF",
  debrief_schedule: a => `NIGHTLY DEBRIEF ${a.on ? "ON" : "OFF"}`,
  import_contact_birthdays: () => "IMPORTING BIRTHDAYS",
  set_ringer: a => `RINGER: ${String(a.mode || "").toUpperCase()}`,
  set_brightness: a => a.auto ? "BRIGHTNESS: AUTO" : `BRIGHTNESS ${a.percent || ""}%`,
});
Object.assign(TOOL_GROUPS, {
  sport: {
    about: "football scores, fixtures and results",
    tools: ["football_scores"],
    match: /\b(football|soccer|match|matches|game|score|scores|fixture|fixtures|league|ahly|zamalek|pyramids|liverpool|arsenal|chelsea|madrid|barcelona|barca|salah|champions league|premier league|who won|kick-?off)\b|الأهلي|الاهلي|الزمالك|ماتش|مباراة|الدوري/i,
  },
  deen: {
    about: "the Qur'an (read, meaning, recitation) and the Hijri calendar (Ramadan, Eid dates)",
    tools: ["quran", "hijri_date"],
    match: /\b(qur'?an|koran|surah|sura|ayah|ayat|verse|recite|recitation|hijri|islamic date|ramadan|eid|arafah|mawlid|muharram)\b|قرآن|القرآن|سورة|آية|رمضان|العيد|هجري/i,
  },
  wellbeing: {
    about: "screen time, sleep, the evening debrief",
    tools: ["screen_time", "sleep_report", "evening_debrief", "debrief_schedule"],
    match: /\b(screen ?time|how long (was|have) i|on my phone|tiktok|instagram|facebook|youtube|usage|sleep|slept|bedtime|debrief|wrap up|my day|how was my day)\b|نمت|النوم/i,
  },
});
TOOL_GROUPS.world.tools.push("gold_price");
TOOL_GROUPS.world.match = new RegExp(TOOL_GROUPS.world.match.source + "|\\b(gold|karat|carat|21k|24k|18k)\\b|دهب|ذهب", "i");
TOOL_GROUPS.life.tools.push("import_contact_birthdays");
TOOL_GROUPS.phone.tools.push("set_ringer", "set_brightness");
TOOL_GROUPS.phone.match = new RegExp(TOOL_GROUPS.phone.match.source + "|\\b(vibrate|ringer|ring mode|brightness|brighter|dimmer|dim the|screen light)\\b", "i");

/* Init ------------------------------------------------------------------------------------ */
function syncDebriefControls() {
  const t = document.getElementById("debriefToggle");
  const tm = document.getElementById("debriefTime");
  if (t) t.checked = !!state.debrief.enabled;
  if (tm) tm.value = state.debrief.time;
}

async function initMore() {
  state.sleepLog = await store.get("sleepLog", []);
  state.bedAt = await store.get("bedAt", null);
  state.debrief = await store.get("debrief", state.debrief);
  syncDebriefControls();
  const t = document.getElementById("debriefToggle");
  const tm = document.getElementById("debriefTime");
  const save = () => {
    state.debrief = { enabled: t.checked, time: tm.value || "21:30" };
    store.set("debrief", state.debrief);
    scheduleDebrief().catch(e => toast(e.message));
  };
  if (t) t.addEventListener("change", save);
  if (tm) tm.addEventListener("change", save);
  if (state.debrief.enabled) scheduleDebrief().catch(() => {});
  LocalNotifications.addListener("localNotificationActionPerformed", async ({ notification }) => {
    if (!notification || !notification.extra || notification.extra.action !== "debrief") return;
    document.getElementById("settingsView").style.display = "none";
    document.querySelector('.tab[data-view="chatView"]').click();
    state.lastGreetAt = Date.now();
    store.set("lastGreetAt", state.lastGreetAt);
    const reply = await ask("Give me my evening debrief.");
    if (reply) await speakWithHud(reply);
  });
  // A tap on the core stops a recitation.
  document.getElementById("reactor").addEventListener("click", e => {
    if (!recitation) return;
    stopRecitation();
    e.stopImmediatePropagation();
  }, true);
}
