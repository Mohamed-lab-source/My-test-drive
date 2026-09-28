/* ======================================================================
 * Jarvis 3.0 — operations
 *
 * Background watchers, meeting mode & dictation, portfolio, relationship
 * radar, reminder actions, live timers, sound design, on this day, and
 * "catch me up". Loads after stark.js.
 * ====================================================================== */

Object.assign(state, {
  watches: [],          // [{id, kind: price|fx|gold21|rain, symbol, label, above, below, lat, lon, threshold, at}]
  portfolio: [],        // [{id, symbol, name, qty, cost, currency}]
  keepInTouch: [],      // [{person, everyDays}]
  uiSounds: true,
  lastSeenAt: 0,
});

/* 1. Watchers (checked natively every ~30 min, even with Jarvis closed) --------------- */
async function syncWatches() {
  store.set("watches", state.watches);
  try { await DeviceActions.setWatches({ watches: state.watches }); } catch (e) { console.warn("watches", e); }
}

// Egyptian Exchange names people actually say (Yahoo lists EGX stocks as XXXX.CA).
// Checked first: "CIB" alone would otherwise be Bancolombia on the NYSE.
const EGX = [
  [/^(cib|commercial international( bank)?|التجاري الدولي)$/i, "COMI.CA", "Commercial International Bank"],
  [/^(tmg|talaat moustafa|talat mostafa|طلعت مصطفى)$/i, "TMGH.CA", "Talaat Moustafa Group"],
  [/^(fawry|فوري)$/i, "FWRY.CA", "Fawry"], [/^(efg|efg hermes|hermes|هيرميس)$/i, "HRHO.CA", "EFG Holding"],
  [/^(eastern( company)?|الشرقية للدخان)$/i, "EAST.CA", "Eastern Company"], [/^(abu qir|abou kir|ابوقير)$/i, "ABUK.CA", "Abu Qir Fertilizers"],
  [/^(telecom egypt|we|المصرية للاتصالات)$/i, "ETEL.CA", "Telecom Egypt"], [/^(elsewedy|el sewedy|السويدي)$/i, "SWDY.CA", "Elsewedy Electric"],
  [/^(ezz|ezz steel|حديد عز)$/i, "ESRS.CA", "Ezz Steel"], [/^(palm hills|بالم هيلز)$/i, "PHDC.CA", "Palm Hills"],
  [/^(orascom construction|اوراسكوم)$/i, "ORAS.CA", "Orascom Construction"], [/^(egx ?30|egx|البورصة المصرية)$/i, "^CASE30", "EGX 30"],
];
async function resolveSymbol(q) {
  const s = String(q || "").trim().replace(/\s+(shares?|stocks?|سهم)$/i, "");
  const egx = EGX.find(([re]) => re.test(s));
  if (egx) return { symbol: egx[1], name: egx[2] };
  if (/^[A-Z0-9.\-=^]{1,15}$/.test(s)) return { symbol: s, name: s };
  const crypto = { bitcoin: "BTC-USD", btc: "BTC-USD", ethereum: "ETH-USD", eth: "ETH-USD", solana: "SOL-USD", dogecoin: "DOGE-USD" };
  if (crypto[s.toLowerCase()]) return { symbol: crypto[s.toLowerCase()], name: s };
  const r = await httpGetJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(s)}&quotesCount=1&newsCount=0`);
  if (!r.quotes || !r.quotes.length) throw new Error(`I couldn't find a market symbol for "${s}". For Egyptian stocks try the EGX code, e.g. COMI.CA.`);
  return { symbol: r.quotes[0].symbol, name: r.quotes[0].shortname || r.quotes[0].longname || s };
}

async function addWatch({ what, above, below, rain_threshold } = {}) {
  const w = String(what || "").trim();
  const id = makeId();
  let watch;
  if (/rain|umbrella|weather|مطر/i.test(w)) {
    const place = await resolvePlace();
    watch = { id, kind: "rain", label: "Rain", lat: place.lat, lon: place.lon, threshold: clampNum(rain_threshold, 20, 100, 60) };
  } else {
    if (above === undefined && below === undefined) throw new Error("Above or below what price?");
    if (/gold|دهب|ذهب/i.test(w)) watch = { id, kind: "gold21", label: "21k gold (EGP/g)" };
    else if (/dollar|usd|egp|pound|currency|rate|exchange/i.test(w)) watch = { id, kind: "fx", symbol: "EGP=X", label: "USD→EGP" };
    else { const s = await resolveSymbol(w); watch = { id, kind: "price", symbol: s.symbol, label: s.name }; }
    if (above !== undefined && above !== null) watch.above = Number(above); else watch.below = Number(below);
  }
  watch.at = new Date().toISOString();
  state.watches.push(watch);
  state.watches = state.watches.slice(-20);
  await syncWatches();
  return { watching: watch.label, condition: watch.kind === "rain" ? `rain chance ≥ ${watch.threshold}% in the next 12 h (once a day)` : watch.above !== undefined ? `above ${watch.above}` : `below ${watch.below}`, note: "Checked about every 30 minutes, even with Jarvis closed." };
}

async function listWatches() {
  let fired = {};
  try { fired = JSON.parse((await DeviceActions.getWatchState()).fired || "{}"); } catch {}
  return { watches: state.watches.map(w => ({ id: w.id, what: w.label, condition: w.kind === "rain" ? `rain ≥ ${w.threshold}%` : w.above !== undefined ? `above ${w.above}` : `below ${w.below}`, triggered: fired[w.id] ? (w.kind === "rain" ? `today (${fired[w.id]})` : `yes, at ${String(fired[w.id]).split("|")[0]}`) : "not yet" })) };
}

async function removeWatch({ what } = {}) {
  const q = String(what || "").toLowerCase();
  const before = state.watches.length;
  const kindOf = /dollar|usd|egp|pound|currency|exchange|rate/.test(q) ? "fx" : /gold|دهب|ذهب/.test(q) ? "gold21" : /rain|umbrella|مطر/.test(q) ? "rain" : null;
  state.watches = q === "all" ? [] : state.watches.filter(w => !(w.id === what || w.kind === kindOf || w.label.toLowerCase().includes(q) || (w.symbol || "").toLowerCase().includes(q)));
  if (state.watches.length === before) throw new Error(`No watcher matching "${what}".`);
  await syncWatches();
  return { removed: before - state.watches.length, remaining: state.watches.length };
}

/* 2–3. Meeting mode and dictation: continuous capture ---------------------------------- */
let capturing = null;
const CAPTURE_STOP = /^(stop( recording| dictation| the meeting)?|end (the )?(meeting|dictation|recording)|that'?s (the end|all)|finish(ed)?|done)$|^(خلاص|كفاية|وقف)$/i;

async function continuousCapture(mode, title) {
  const wasActive = conversationActive;
  conversationActive = true;
  capturing = { mode, lines: [], started: Date.now() };
  addToolMsg(mode === "meeting" ? "› MEETING MODE · RECORDING · SAY \"END MEETING\" OR TAP THE CORE" : "› DICTATION · SAY \"STOP DICTATION\" WHEN DONE");
  const liveEl = addMsg("tool", "");
  let silences = 0;
  try {
    while (conversationActive && Date.now() - capturing.started < 3 * 3600e3) {
      let heard = "";
      try { heard = await listenOnce(); } catch { heard = ""; }
      if (!conversationActive) break;
      if (!heard) { if (++silences >= (mode === "meeting" ? 40 : 4)) break; continue; }
      silences = 0;
      if (CAPTURE_STOP.test(heard.trim())) break;
      capturing.lines.push(heard);
      liveEl.textContent = `› ${capturing.lines.length} LINES · ${capturing.lines.slice(-2).join(" … ").slice(-140)}`;
    }
  } finally {
    if (conversationActive) conversationActive = wasActive;
    if (!conversationActive) resumeWakeWord();
  }
  const lines = capturing.lines;
  const minutes = Math.max(1, Math.round((Date.now() - capturing.started) / 60000));
  capturing = null;
  if (!lines.length) return { captured: false, note: "Nothing was heard." };
  const transcript = lines.join(". ").replace(/\.\s*\./g, ".");
  const prompt = mode === "meeting"
    ? "Summarise this meeting transcript (speech-to-text, may contain errors). Output plain text in this order: a 2-3 sentence summary; 'Decisions:' as short lines; 'Action items:' as 'who – what – when' lines if stated. Under 180 words. No markdown symbols."
    : "Clean up this dictation into readable text: fix punctuation and obvious speech-to-text errors, keep the author's words and meaning, no additions. Then on a first line give a short title prefixed 'Title: '.";
  let processed = "";
  try {
    const data = await callGroq([{ role: "system", content: prompt }, { role: "user", content: transcript.slice(0, 14000) }], { withTools: false, model: "openai/gpt-oss-20b" });
    processed = collapseRepeats((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "");
  } catch (e) { processed = ""; }
  const stamp = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (mode === "meeting") {
    takeNote(`Meeting${title ? " — " + title : ""} (${stamp}, ${minutes} min)\n${processed || transcript}`);
    return { saved: "meeting notes", minutes, lines: lines.length, summary: processed || "(summary unavailable; the raw transcript was saved)", note: "Offer to turn action items into reminders." };
  }
  const m = processed.match(/^Title:\s*(.+)\n+([\s\S]*)$/i);
  const body = m ? m[2].trim() : processed || transcript;
  const noteTitle = title || (m ? m[1].trim() : "Dictation");
  takeNote(`${noteTitle} (${stamp})\n${body}`);
  return { saved: noteTitle, words: body.split(/\s+/).length };
}

/* 4. Portfolio ------------------------------------------------------------------------ */
function savePortfolio() { store.set("portfolio", state.portfolio); renderPortfolio(); }

async function portfolioAdd({ what, qty, cost_per_share, sell } = {}) {
  const s = await resolveSymbol(what);
  const q = Number(qty);
  if (!(q > 0)) throw new Error("How many shares or coins?");
  const existing = state.portfolio.find(p => p.symbol === s.symbol);
  if (sell) {
    if (!existing) throw new Error(`You don't hold ${s.name}.`);
    existing.qty = Math.round((existing.qty - q) * 1e6) / 1e6;
    if (existing.qty <= 0) state.portfolio = state.portfolio.filter(p => p !== existing);
  } else if (existing) {
    const c = Number(cost_per_share);
    if (c > 0 && existing.cost) existing.cost = (existing.cost * existing.qty + c * q) / (existing.qty + q); // average cost
    existing.qty += q;
  } else {
    state.portfolio.push({ id: makeId(), symbol: s.symbol, name: s.name, qty: q, cost: Number(cost_per_share) > 0 ? Number(cost_per_share) : null });
  }
  savePortfolio();
  return portfolioStatus();
}

async function portfolioStatus() {
  if (!state.portfolio.length) return { holdings: [], note: 'Nothing yet. "I bought 100 shares of CIB at 80".' };
  const rows = await Promise.all(state.portfolio.map(async p => {
    try {
      const c = await httpGetJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(p.symbol)}?range=1d&interval=1d`);
      const meta = c.chart.result[0].meta;
      const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
      const value = meta.regularMarketPrice * p.qty;
      return {
        name: p.name, symbol: p.symbol, qty: p.qty, price: meta.regularMarketPrice, currency: meta.currency,
        value: Math.round(value), dayChange: Math.round((meta.regularMarketPrice - prev) * p.qty),
        dayChangePct: prev ? Math.round((meta.regularMarketPrice - prev) / prev * 10000) / 100 : 0,
        profit: p.cost ? Math.round((meta.regularMarketPrice - p.cost) * p.qty) : null,
        profitPct: p.cost ? Math.round((meta.regularMarketPrice - p.cost) / p.cost * 10000) / 100 : null,
      };
    } catch { return { name: p.name, symbol: p.symbol, qty: p.qty, error: "price unavailable" }; }
  }));
  const totals = {};
  rows.filter(r => r.value !== undefined).forEach(r => {
    const t = totals[r.currency] || (totals[r.currency] = { value: 0, dayChange: 0, profit: 0 });
    t.value += r.value; t.dayChange += r.dayChange; t.profit += r.profit || 0;
  });
  return { holdings: rows, totals };
}

/* 5. Relationship radar ----------------------------------------------------------------- */
let radarCache = { at: 0, overdue: [] };

async function callHistory() {
  const { calls } = await DeviceActions.getCallLog({ onlyMissed: false, limit: 30 * 10 });
  return calls || [];
}
function lastContact(calls, person) {
  const q = String(person).toLowerCase();
  const hit = calls.filter(c => (c.name || "").toLowerCase().includes(q) && c.type !== "missed" && c.type !== "rejected").sort((a, b) => b.time - a.time)[0];
  return hit ? hit.time : null;
}
async function relationshipCheck() {
  const calls = await callHistory();
  const out = { keepInTouch: [], drifting: [] };
  for (const k of state.keepInTouch) {
    const last = lastContact(calls, k.person);
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    out.keepInTouch.push({ person: k.person, every: `${k.everyDays} days`, lastSpoke: days === null ? "not in recent call log" : `${days} days ago`, overdue: days === null || days > k.everyDays });
  }
  // Frequent contacts gone quiet: 3+ calls in the log, none in the last 3 weeks.
  const byName = {};
  calls.filter(c => c.name).forEach(c => { const b = byName[c.name] || (byName[c.name] = { n: 0, last: 0 }); b.n++; b.last = Math.max(b.last, c.time); });
  out.drifting = Object.entries(byName).filter(([, b]) => b.n >= 3 && Date.now() - b.last > 21 * 86400000)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([name, b]) => ({ person: name, callsInLog: b.n, lastSpoke: `${Math.floor((Date.now() - b.last) / 86400000)} days ago` }));
  radarCache = { at: Date.now(), overdue: out.keepInTouch.filter(k => k.overdue).map(k => `${k.person} (${k.lastSpoke})`) };
  return out;
}
async function keepInTouch({ person, every_days, remove } = {}) {
  const p = String(person || "").trim();
  if (!p) throw new Error("With whom?");
  state.keepInTouch = state.keepInTouch.filter(k => k.person.toLowerCase() !== p.toLowerCase());
  if (!remove) state.keepInTouch.push({ person: p, everyDays: clampNum(every_days, 1, 365, 7) });
  store.set("keepInTouch", state.keepInTouch);
  return relationshipCheck();
}

/* 6. Reminder notification actions ------------------------------------------------------- */
const SNOOZE_ID_BASE = 700000;
async function registerReminderActions() {
  try {
    await LocalNotifications.registerActionTypes({ types: [{ id: "JARVIS_REMINDER", actions: [{ id: "done", title: "Done" }, { id: "snooze", title: "Snooze 10 min" }] }] });
  } catch (e) { console.warn("action types", e); }
  LocalNotifications.addListener("localNotificationActionPerformed", async ({ actionId, notification }) => {
    const rid = notification && notification.extra && notification.extra.reminderId;
    if (!rid) return;
    const r = state.reminders.find(x => x.id === rid);
    if (actionId === "done" && r && !r.done && (!r.repeat || r.repeat === "none")) {
      await toggleReminder(rid);
      logActivity(`REMINDER DONE: ${r.text.toUpperCase().slice(0, 30)}`);
    } else if (actionId === "snooze") {
      await LocalNotifications.schedule({ notifications: [{
        id: SNOOZE_ID_BASE + (Date.now() % 90000), title: "Jarvis reminder", body: notification.body || (r && r.text) || "Reminder",
        actionTypeId: "JARVIS_REMINDER", extra: { reminderId: rid }, schedule: { at: new Date(Date.now() + 10 * 60000), allowWhileIdle: true },
      }] });
      logActivity("REMINDER SNOOZED 10 MIN");
    }
  });
}

/* 7. Live timers in the HUD --------------------------------------------------------------- */
let liveTimers = []; // [{end, label}]
const appSetTimer = setTimer;
setTimer = async function (seconds, label) {
  const r = await appSetTimer(seconds, label);
  liveTimers.push({ end: Date.now() + seconds * 1000, label: label && label !== "Jarvis" ? label : "" });
  store.set("liveTimers", liveTimers);
  tickTimers();
  return r;
};
function tickTimers() {
  const tag = document.getElementById("telTimer"), sep = document.getElementById("telTimerSep");
  const now = Date.now();
  const done = liveTimers.filter(t => t.end <= now);
  liveTimers = liveTimers.filter(t => t.end > now);
  if (done.length) {
    store.set("liveTimers", liveTimers);
    const line = `Time's up, ${state.address}${done[0].label ? ": " + done[0].label : ""}.`;
    buzz("long");
    addMsg("assistant", line);
    if (!busy && !conversationActive && !speakingNow) speakWithHud(line);
  }
  if (!tag) return;
  const next = liveTimers.sort((a, b) => a.end - b.end)[0];
  tag.hidden = sep.hidden = !next;
  if (next) {
    const s = Math.ceil((next.end - now) / 1000);
    tag.textContent = `T-${s >= 3600 ? Math.floor(s / 3600) + ":" : ""}${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`;
  }
}

/* 8. Sound design ---------------------------------------------------------------------------- */
function uiSound(kind) {
  if (!state.uiSounds || state.silentMode) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== "running") return;
    const seq = { card: [[1760, 0.03, 0.05], [2349, 0.03, 0.04]], scan: [[440, 0.25, 0.04], [880, 0.25, 0.04]], boot: [[220, 0.2, 0.05], [440, 0.2, 0.05], [880, 0.35, 0.06]] }[kind];
    if (!seq) return;
    let t = audioCtx.currentTime;
    for (const [f, dur, vol] of seq) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === "card" ? "sine" : "triangle";
      o.frequency.setValueAtTime(f, t);
      if (kind !== "card") o.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  } catch {}
}
const starkPlaceCard = placeCard;
placeCard = function (card) { starkPlaceCard(card); uiSound("card"); };
const presenceBootSequence = bootSequence;
bootSequence = async function () { uiSound("boot"); return presenceBootSequence(); };
const starkSystemScan = systemScan;
systemScan = async function () { uiSound("scan"); return starkSystemScan(); };

/* 9. On this day ---------------------------------------------------------------------------- */
async function onThisDay() {
  const d = new Date();
  const j = await httpGetJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`, { "User-Agent": "JarvisPersonalAssistant/3.0 (personal use)" });
  const events = (j.selected || []).filter(e => e.text && e.year);
  const picks = events.sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a.year - b.year);
  return { date: d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }), events: picks.map(e => ({ year: e.year, what: e.text.slice(0, 220) })), note: "Pick the most interesting one or two; one line each." };
}

/* 10. Catch me up ------------------------------------------------------------------------------ */
async function catchMeUp() {
  const since = state.lastSeenAt || Date.now() - 12 * 3600e3;
  const minutes = Math.max(15, Math.round((Date.now() - since) / 60000));
  const out = { since: fmtWhen(new Date(since).toISOString()) };
  const jobs = [];
  if (abilities.notifications) jobs.push(readMessages(Math.min(minutes, 24 * 60)).then(m => { out.messages = m.slice(0, 12).map(x => ({ from: x.from, app: x.app, text: String(x.text).slice(0, 120) })); }));
  jobs.push(DeviceActions.getCallLog({ onlyMissed: true, limit: 10 }).then(({ calls }) => { out.missedCalls = (calls || []).filter(c => c.time >= since).map(c => ({ who: c.name || c.number, when: minutesAgo(c.time) })); }));
  if (state.calendarRefreshToken) {
    jobs.push(listUnreadEmails(5).then(e => { out.unreadEmails = e.map(x => ({ from: x.from, subject: x.subject })); }));
    jobs.push(listTodayEvents().then(evs => { out.stillToday = evs.filter(e => e.start && e.start.includes("T") && new Date(e.start) > new Date()).slice(0, 3).map(e => `${e.title} ${hhmm(e.start)}`); }));
  }
  jobs.push(DeviceActions.getWatchState().then(w => {
    const fired = JSON.parse(w.fired || "{}");
    out.alerts = state.watches.filter(x => fired[x.id] && (x.kind === "rain" || Number(String(fired[x.id]).split("|")[1] || 0) >= since)).map(x => x.label);
  }));
  await Promise.allSettled(jobs);
  out.overdueReminders = state.reminders.filter(r => !r.done && r.time && new Date(r.time) < new Date() && new Date(r.time) >= new Date(since)).map(r => r.text);
  out.trackers = trackerNudges();
  if (radarCache.overdue.length) out.keepInTouch = radarCache.overdue;
  return out;
}

/* Prompt and card ------------------------------------------------------------------------------ */
const starkPromptLines = presencePromptLines;
presencePromptLines = function () {
  const out = starkPromptLines();
  if (radarCache.overdue.length) out.push(`Overdue to call (keep-in-touch): ${radarCache.overdue.join(", ")}.`);
  if (liveTimers.length) out.push(`Timers running: ${liveTimers.map(t => `${Math.ceil((t.end - Date.now()) / 60000)} min left${t.label ? " (" + t.label + ")" : ""}`).join(", ")}.`);
  return out;
};

CARD_BUILDERS.portfolio_status = r => {
  if (!r.holdings || !r.holdings.length) return null;
  const c = hudCard("PORTFOLIO");
  Object.entries(r.totals || {}).forEach(([cur, t]) => {
    const b = big(`${t.value.toLocaleString()} ${cur}`, `${t.dayChange >= 0 ? "▲" : "▼"} ${Math.abs(t.dayChange).toLocaleString()} today`);
    if (t.dayChange < 0) b.classList.add("down");
    c.appendChild(b);
  });
  r.holdings.forEach(h => c.appendChild(statRow(`${h.name} ×${h.qty}`, h.error ? h.error : `${h.value.toLocaleString()} ${h.currency}${h.profitPct !== null ? ` · ${h.profitPct >= 0 ? "+" : ""}${h.profitPct}%` : ""}`, h.profitPct < 0)));
  return c;
};
CARD_BUILDERS.portfolio_update = CARD_BUILDERS.portfolio_status;
CARD_BUILDERS.on_this_day = r => { const c = hudCard(`ON THIS DAY · ${r.date}`); r.events.forEach(e => c.appendChild(statRow(String(e.year), e.what.slice(0, 70) + (e.what.length > 70 ? "…" : "")))); return c; };

async function renderPortfolio() {
  const box = document.getElementById("portfolioBox");
  if (!box) return;
  box.innerHTML = "";
  if (!state.portfolio.length) { box.appendChild(el("div", "empty-hint", '"I bought 100 shares of CIB at 80", "I have 0.05 bitcoin".')); return; }
  box.appendChild(el("div", "empty-hint", "Updating prices…"));
  const r = await portfolioStatus();
  box.innerHTML = "";
  Object.entries(r.totals || {}).forEach(([cur, t]) => box.appendChild(statRow(`Total (${cur})`, `${t.value.toLocaleString()} · ${t.dayChange >= 0 ? "+" : ""}${t.dayChange.toLocaleString()} today`, t.dayChange < 0)));
  r.holdings.forEach(h => box.appendChild(statRow(`${h.name} ×${h.qty}`, h.error || `${h.value.toLocaleString()}${h.profitPct !== null ? ` (${h.profitPct >= 0 ? "+" : ""}${h.profitPct}%)` : ""}`, h.profitPct < 0)));
}

/* Tools ------------------------------------------------------------------------------------------ */
FEATURE_TOOLS.push(
  xfn("add_watch", "Watch something in the background and notify when it happens: a stock/crypto/currency/gold price crossing a level, or rain coming.", { what: { type: "string", description: "e.g. bitcoin, CIB, Apple, gold, dollar, rain" }, above: xn, below: xn, rain_threshold: { type: "integer" } }, ["what"]),
  xfn("list_watches", "The background watchers and whether they've triggered."),
  xfn("remove_watch", "Stop a watcher (by name, or 'all').", { what: xs }, ["what"]),
  xfn("meeting_mode", "Record and transcribe a meeting or lecture continuously until told to stop, then save a summary with decisions and action items to notes.", { title: xs }),
  xfn("dictation", "Take down a long note by voice until the user says stop, then clean it up and save it.", { title: xs }),
  xfn("portfolio_update", "Add to (or sell from) the user's investment portfolio: stocks (incl. EGX like CIB), ETFs, crypto.", { what: xs, qty: xn, cost_per_share: xn, sell: { type: "boolean" } }, ["what", "qty"]),
  xfn("portfolio_status", "Current value, today's change and profit/loss of the portfolio."),
  xfn("keep_in_touch", "Set (or remove) how often the user wants to speak to someone; Jarvis checks the call log and nudges only if they're overdue.", { person: xs, every_days: { type: "integer" }, remove: { type: "boolean" } }, ["person"]),
  xfn("relationship_check", "Who the user is overdue to call, and frequent contacts they haven't spoken to lately (from the call log)."),
  xfn("on_this_day", "Notable historical events on today's date."),
  xfn("catch_me_up", "Everything since the user last opened Jarvis: messages, missed calls, emails, overdue reminders, alerts, tracker items."),
);
Object.assign(FEATURE_HANDLERS, {
  add_watch: a => addWatch(a), list_watches: () => listWatches(), remove_watch: a => removeWatch(a),
  meeting_mode: a => continuousCapture("meeting", a.title), dictation: a => continuousCapture("dictation", a.title),
  portfolio_update: a => portfolioAdd(a), portfolio_status: () => portfolioStatus(),
  keep_in_touch: a => keepInTouch(a), relationship_check: () => relationshipCheck(),
  on_this_day: () => onThisDay(), catch_me_up: () => catchMeUp(),
});
Object.assign(FEATURE_LABELS, {
  add_watch: a => `WATCHER ARMED: ${a.what || ""}`, list_watches: () => "REVIEWING WATCHERS", remove_watch: a => `WATCHER REMOVED: ${a.what || ""}`,
  meeting_mode: () => "MEETING MODE", dictation: () => "DICTATION",
  portfolio_update: a => `PORTFOLIO: ${a.sell ? "-" : "+"}${a.qty || ""} ${a.what || ""}`, portfolio_status: () => "VALUING PORTFOLIO",
  keep_in_touch: a => `KEEP IN TOUCH: ${a.person || ""}`, relationship_check: () => "RELATIONSHIP RADAR",
  on_this_day: () => "CONSULTING THE ARCHIVES", catch_me_up: () => "COMPILING SITREP",
});
Object.assign(TOOL_GROUPS, {
  watch: {
    about: "background price and rain alerts, investment portfolio",
    tools: ["add_watch", "list_watches", "remove_watch", "portfolio_update", "portfolio_status"],
    match: /\b(tell me when|let me know when|alert me|notify me|watch(er|ers)?|crosses|drops below|goes above|goes below|portfolio|shares?|stocks?|holdings|invest\w*|bought \d|sold \d|bitcoin|crypto|egx|cib|rain)\b|سهم|أسهم|بورصة/i,
  },
  capture: {
    about: "meeting mode (transcribe and summarise), long dictation",
    tools: ["meeting_mode", "dictation"],
    match: /\b(meeting|lecture|record (this|the)|transcribe|minutes|dictat\w*|long note|take this down|write down everything)\b|اجتماع|محاضرة/i,
  },
  social: {
    about: "keep-in-touch reminders and who the user hasn't called lately",
    tools: ["keep_in_touch", "relationship_check"],
    match: /\b(keep in touch|haven'?t (called|spoken|talked)|call (\w+ )?every|lost touch|who should i call|relationship)\b/i,
  },
  digest: {
    about: "catch-up digest since last open, on this day in history",
    tools: ["catch_me_up", "on_this_day"],
    match: /\b(catch me up|what did i miss|what'?s new|sitrep|while i was (away|gone)|on this day|this day in history|something interesting)\b|فاتني|حصل ايه/i,
  },
});

/* Init ------------------------------------------------------------------------------------------- */
async function initOps() {
  state.watches = await store.get("watches", []);
  state.portfolio = await store.get("portfolio", []);
  state.keepInTouch = await store.get("keepInTouch", []);
  state.uiSounds = await store.get("uiSounds", true);
  state.lastSeenAt = await store.get("lastSeenAt", 0);
  liveTimers = (await store.get("liveTimers", [])).filter(t => t.end > Date.now());
  if (state.watches.length) syncWatches();
  registerReminderActions();
  setInterval(tickTimers, 1000);
  const snd = document.getElementById("uiSoundsToggle");
  if (snd) { snd.checked = state.uiSounds; snd.addEventListener("change", () => { state.uiSounds = snd.checked; store.set("uiSounds", snd.checked); uiSound("card"); }); }
  App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) { state.lastSeenAt = Date.now(); store.set("lastSeenAt", state.lastSeenAt); }
    else if (state.keepInTouch.length && Date.now() - radarCache.at > 6 * 3600e3) relationshipCheck().catch(() => {});
  });
  if (state.keepInTouch.length) relationshipCheck().catch(() => {});
  const tab = document.querySelector('.tab[data-view="trackersView"]');
  if (tab) tab.addEventListener("click", () => renderPortfolio().catch(() => {}));
}
