/* ======================================================================
 * Jarvis 2.8 — trackers
 *
 * Water, workouts, weight, mood, medications, car, bills, debts, goals —
 * a Trackers tab to see them, notifications where timing matters, and
 * noteworthy items fed to Jarvis so he brings them up unprompted.
 * Plus backup / restore of all data. Loads after more.js.
 * ====================================================================== */

const { Filesystem } = (window.Capacitor && window.Capacitor.Plugins) || {};

const T = {
  water: { goal: 8, days: {}, reminders: false },
  workouts: [],        // {id, at, type, minutes, distanceKm, sets, reps, weightKg, note}
  weight: [],          // {at, kg}
  weightGoal: null,
  mood: [],            // {at, score, energy, note}
  meds: [],            // {id, name, dose, times: ["08:00"], taken: {"YYYY-MM-DD": ["08:00"]}}
  car: { fuel: [], serviceEveryKm: 5000, lastServiceKm: null, lastServiceAt: null },
  bills: [],           // {id, name, amount, currency, dueDay, paid: ["YYYY-MM"]}
  debts: [],           // {id, person, amount, currency, direction: "owes_me"|"i_owe", note, at, settled}
  goals: [],           // {id, name, target, unit, progress, deadline, at}
};
function saveTrackers() { store.set("trackers", T); renderTrackers(); }
const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const money = (v, c) => `${Math.round(v * 100) / 100} ${c}`;
const hmMin = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const since = days => Date.now() - days * 86400000;
const periodDays = p => ({ today: 1, week: 7, month: 30, year: 365 }[p] || 7);

/* Water ------------------------------------------------------------------ */
const WATER_ID_BASE = 610000;
const WATER_TIMES = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

async function logWater({ glasses = 1, undo, goal, reminders } = {}) {
  if (goal) T.water.goal = clampNum(goal, 1, 30, 8);
  if (typeof reminders === "boolean") { T.water.reminders = reminders; await scheduleWaterReminders(); }
  const day = localDayKey();
  const n = goal && !glasses ? 0 : clampNum(glasses, 0, 20, 1);
  if (n) T.water.days[day] = Math.max(0, (T.water.days[day] || 0) + (undo ? -n : n));
  const keys = Object.keys(T.water.days).sort();
  keys.slice(0, -120).forEach(k => delete T.water.days[k]);
  saveTrackers();
  const today = T.water.days[day] || 0;
  return { today, goal: T.water.goal, remaining: Math.max(0, T.water.goal - today), reminders: T.water.reminders ? "on" : "off" };
}

async function scheduleWaterReminders() {
  try { await LocalNotifications.cancel({ notifications: WATER_TIMES.map((_, i) => ({ id: WATER_ID_BASE + i })) }); } catch {}
  if (!T.water.reminders || !(await ensureNotifyPermission())) return;
  await LocalNotifications.schedule({ notifications: WATER_TIMES.map((t, i) => {
    const [hour, minute] = t.split(":").map(Number);
    return { id: WATER_ID_BASE + i, title: "Hydration", body: pick([`A glass of water, ${state.address}?`, `Water check, ${state.address}.`, "Time for some water."]), schedule: { on: { hour, minute }, allowWhileIdle: true } };
  }) });
}

/* Workouts --------------------------------------------------------------- */
function logWorkout({ type, minutes, distance_km, sets, reps, weight_kg, note } = {}) {
  const w = {
    id: makeId(), at: new Date().toISOString(), type: String(type || "workout").toLowerCase().trim().slice(0, 40),
    minutes: minutes ? clampNum(minutes, 1, 600, null) : null, distanceKm: distance_km ? clampNum(distance_km, 0.01, 500, null) : null,
    sets: sets ? clampNum(sets, 1, 100, null) : null, reps: reps ? clampNum(reps, 1, 1000, null) : null,
    weightKg: weight_kg ? clampNum(weight_kg, 0.1, 1000, null) : null, note: String(note || "").slice(0, 100),
  };
  const previous = T.workouts.filter(x => x.type === w.type);
  const pr = [];
  if (w.weightKg && previous.every(x => !x.weightKg || x.weightKg < w.weightKg) && previous.length) pr.push(`heaviest ${w.type}: ${w.weightKg} kg`);
  if (w.distanceKm && previous.every(x => !x.distanceKm || x.distanceKm < w.distanceKm) && previous.length) pr.push(`longest ${w.type}: ${w.distanceKm} km`);
  if (w.distanceKm && w.minutes) {
    const pace = w.minutes / w.distanceKm;
    const best = previous.filter(x => x.distanceKm && x.minutes).map(x => x.minutes / x.distanceKm);
    if (best.length && best.every(p => pace < p)) pr.push(`fastest pace: ${pace.toFixed(1)} min/km`);
  }
  T.workouts.unshift(w);
  T.workouts = T.workouts.slice(0, 1000);
  saveTrackers();
  const week = T.workouts.filter(x => new Date(x.at) >= since(7));
  return { logged: w.type, personalRecords: pr.length ? pr : undefined, thisWeek: { sessions: week.length, minutes: week.reduce((s, x) => s + (x.minutes || 0), 0) } };
}

/* Weight ----------------------------------------------------------------- */
function weightChange(days) {
  const cutoff = since(days);
  const older = T.weight.filter(w => new Date(w.at) <= cutoff).pop();
  const latest = T.weight[T.weight.length - 1];
  return older && latest ? Math.round((latest.kg - older.kg) * 10) / 10 : null;
}
function logWeight({ kg, goal_kg } = {}) {
  if (goal_kg) T.weightGoal = clampNum(goal_kg, 20, 400, null);
  if (kg) {
    T.weight.push({ at: new Date().toISOString(), kg: Math.round(clampNum(kg, 20, 400, 0) * 10) / 10 });
    T.weight = T.weight.slice(-730);
  }
  saveTrackers();
  const latest = T.weight[T.weight.length - 1];
  return {
    latest: latest ? `${latest.kg} kg` : null, changeThisWeek: weightChange(7), changeThisMonth: weightChange(30),
    goal: T.weightGoal ? `${T.weightGoal} kg` : null, toGo: latest && T.weightGoal ? Math.round((latest.kg - T.weightGoal) * 10) / 10 : null,
  };
}

/* Mood ------------------------------------------------------------------- */
function logMood({ score, energy, note } = {}) {
  const s = clampNum(score, 1, 10, null);
  if (!s) throw new Error("A score from 1 to 10, please.");
  T.mood.push({ at: new Date().toISOString(), score: s, energy: energy ? clampNum(energy, 1, 10, null) : null, note: String(note || "").slice(0, 140) });
  T.mood = T.mood.slice(-500);
  saveTrackers();
  const week = T.mood.filter(m => new Date(m.at) >= since(7));
  return { logged: s, weekAverage: Math.round(week.reduce((a, m) => a + m.score, 0) / week.length * 10) / 10, entriesThisWeek: week.length };
}

/* Medications -------------------------------------------------------------- */
const MED_ID_BASE = 600000;
function findMed(name) {
  const q = String(name || "").toLowerCase().trim();
  return T.meds.find(m => m.name.toLowerCase() === q) || T.meds.find(m => m.name.toLowerCase().includes(q) || q.includes(m.name.toLowerCase()));
}
async function scheduleMedReminders() {
  const old = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 6; j++) old.push({ id: MED_ID_BASE + i * 10 + j });
  try { await LocalNotifications.cancel({ notifications: old }); } catch {}
  if (!T.meds.length || !(await ensureNotifyPermission())) return;
  const notifications = [];
  T.meds.slice(0, 20).forEach((m, i) => m.times.slice(0, 6).forEach((t, j) => {
    const [hour, minute] = t.split(":").map(Number);
    notifications.push({ id: MED_ID_BASE + i * 10 + j, title: "Medication", body: `Time for your ${m.name}${m.dose ? " (" + m.dose + ")" : ""}, ${state.address}.`, schedule: { on: { hour, minute }, allowWhileIdle: true } });
  }));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
async function addMedication({ name, dose, times } = {}) {
  const n = String(name || "").trim();
  if (!n) throw new Error("Which medication?");
  const list = (Array.isArray(times) ? times : String(times || "").split(/[,\s]+/)).map(t => parseClock(t)).filter(Boolean).map(t => `${pad2(t.h)}:${pad2(t.min)}`);
  if (!list.length) throw new Error('At what times? e.g. "08:00, 20:00".');
  const existing = findMed(n);
  if (existing && existing.name.toLowerCase() === n.toLowerCase()) { existing.times = list; existing.dose = dose || existing.dose; }
  else T.meds.push({ id: makeId(), name: n, dose: String(dose || "").slice(0, 40), times: [...new Set(list)].sort(), taken: {} });
  saveTrackers();
  await scheduleMedReminders();
  return { saved: n, times: list, note: "Reminders set every day at those times." };
}
function medTaken({ name, time } = {}) {
  const day = localDayKey();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const meds = name ? [findMed(name)].filter(Boolean) : T.meds;
  if (!meds.length) throw new Error(name ? `No medication called "${name}".` : "No medications saved yet.");
  const marked = [];
  for (const m of meds) {
    const taken = m.taken[day] || (m.taken[day] = []);
    // The dose meant: the named time, else the latest one due (or the next one, if taken early).
    const due = m.times.filter(t => !taken.includes(t));
    let slot = time ? m.times.find(t => t === time) : null;
    if (!slot) slot = due.filter(t => { const [h, mm] = t.split(":").map(Number); return h * 60 + mm <= nowMin + 90; }).pop() || due[0];
    if (slot && !taken.includes(slot)) { taken.push(slot); marked.push(`${m.name} (${slot})`); }
    Object.keys(m.taken).sort().slice(0, -60).forEach(k => delete m.taken[k]);
  }
  saveTrackers();
  return { marked: marked.length ? marked : "nothing outstanding", today: medStatusToday() };
}
function medStatusToday() {
  const day = localDayKey();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return T.meds.map(m => ({
    name: m.name,
    doses: m.times.map(t => {
      const [h, mm] = t.split(":").map(Number);
      const taken = (m.taken[day] || []).includes(t);
      return `${t} ${taken ? "taken" : h * 60 + mm + 30 < nowMin ? "MISSED" : "due"}`;
    }),
  }));
}
async function removeMedication({ name } = {}) {
  const m = findMed(name);
  if (!m) throw new Error(`No medication called "${name}".`);
  T.meds = T.meds.filter(x => x !== m);
  saveTrackers();
  await scheduleMedReminders();
  return { removed: m.name };
}

/* Car -------------------------------------------------------------------------- */
function carStats() {
  const fills = T.car.fuel.filter(f => f.odometer).sort((a, b) => a.odometer - b.odometer);
  const out = {};
  if (fills.length >= 2) {
    const km = fills[fills.length - 1].odometer - fills[0].odometer;
    const liters = fills.slice(1).reduce((s, f) => s + (f.liters || 0), 0);
    const cost = fills.slice(1).reduce((s, f) => s + (f.cost || 0), 0);
    if (km > 0 && liters > 0) out.kmPerLiter = Math.round(km / liters * 10) / 10;
    if (km > 0 && cost > 0) out.costPerKm = Math.round(cost / km * 100) / 100;
  }
  const lastOdo = Math.max(0, ...T.car.fuel.map(f => f.odometer || 0), T.car.lastServiceKm || 0);
  if (lastOdo) out.odometer = lastOdo;
  if (T.car.lastServiceKm && lastOdo) out.kmToService = T.car.lastServiceKm + T.car.serviceEveryKm - lastOdo;
  const month = T.car.fuel.filter(f => f.at.startsWith(monthKey()));
  out.fuelThisMonth = money(month.reduce((s, f) => s + (f.cost || 0), 0), state.currency);
  return out;
}
function logFuel({ liters, cost, odometer } = {}) {
  if (!liters && !cost && !odometer) throw new Error("Liters, cost or the odometer reading, at least one.");
  T.car.fuel.push({ at: new Date().toISOString(), liters: liters ? Number(liters) : null, cost: cost ? Number(cost) : null, odometer: odometer ? Number(odometer) : null });
  T.car.fuel = T.car.fuel.slice(-300);
  saveTrackers();
  if (cost) logExpense({ amount: cost, category: "fuel" });
  return carStats();
}
function logService({ odometer, every_km } = {}) {
  if (every_km) T.car.serviceEveryKm = clampNum(every_km, 500, 50000, 5000);
  if (odometer) { T.car.lastServiceKm = Number(odometer); T.car.lastServiceAt = new Date().toISOString(); }
  saveTrackers();
  return { serviceEveryKm: T.car.serviceEveryKm, lastServiceKm: T.car.lastServiceKm, ...carStats() };
}

/* Bills ------------------------------------------------------------------------- */
const BILL_ID_BASE = 620000;
// Due on the 31st in a 30-day month means the 30th (and the 28th/29th in February).
const dueIn = (y, m, day) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
function nextDue(b, from = new Date()) {
  const paidThisMonth = b.paid.includes(monthKey(from));
  let d = dueIn(from.getFullYear(), from.getMonth(), b.dueDay);
  if (paidThisMonth || d < startOfDay(from)) d = dueIn(from.getFullYear(), from.getMonth() + 1, b.dueDay);
  return d;
}
async function scheduleBillReminders() {
  try { await LocalNotifications.cancel({ notifications: Array.from({ length: 30 }, (_, i) => ({ id: BILL_ID_BASE + i })) }); } catch {}
  const now = new Date();
  const notifications = T.bills.slice(0, 30).map((b, i) => {
    const at = new Date(nextDue(b).getTime() - 86400000); at.setHours(10, 0, 0, 0);
    return at > now ? { id: BILL_ID_BASE + i, title: "Bill due tomorrow", body: `${b.name}: ${money(b.amount, b.currency)}, ${state.address}.`, schedule: { at, allowWhileIdle: true } } : null;
  }).filter(Boolean);
  if (notifications.length && await ensureNotifyPermission()) await LocalNotifications.schedule({ notifications });
}
async function addBill({ name, amount, due_day, currency } = {}) {
  const n = String(name || "").trim();
  if (!n || !amount || !due_day) throw new Error("Name, amount and the day of the month it's due.");
  T.bills = T.bills.filter(b => b.name.toLowerCase() !== n.toLowerCase());
  T.bills.push({ id: makeId(), name: n, amount: Number(amount), currency: String(currency || state.currency).toUpperCase().slice(0, 3), dueDay: clampNum(due_day, 1, 31, 1), paid: [] });
  saveTrackers();
  await scheduleBillReminders();
  return billsStatus();
}
async function billPaid({ name } = {}) {
  const q = String(name || "").toLowerCase();
  const b = T.bills.find(x => x.name.toLowerCase().includes(q));
  if (!b) throw new Error(`No bill called "${name}".`);
  const key = monthKey(new Date(nextDue(b).getTime()));
  if (!b.paid.includes(key)) b.paid.push(key);
  b.paid = b.paid.slice(-24);
  saveTrackers();
  logExpense({ amount: b.amount, currency: b.currency, category: "bills", note: b.name });
  await scheduleBillReminders();
  return { paid: b.name, nextDue: nextDue(b).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) };
}
async function removeBill({ name } = {}) {
  const q = String(name || "").toLowerCase();
  const b = T.bills.find(x => x.name.toLowerCase().includes(q));
  if (!b) throw new Error(`No bill called "${name}".`);
  T.bills = T.bills.filter(x => x !== b);
  saveTrackers();
  await scheduleBillReminders();
  return { removed: b.name };
}
function billsStatus() {
  const today = startOfDay();
  const totals = {};
  T.bills.forEach(b => { totals[b.currency] = (totals[b.currency] || 0) + b.amount; });
  return {
    monthlyTotal: Object.entries(totals).map(([c, v]) => money(v, c)).join(" + ") || "none",
    bills: T.bills.map(b => { const d = nextDue(b); return { name: b.name, amount: money(b.amount, b.currency), due: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), inDays: Math.round((d - today) / 86400000) }; })
      .sort((a, b) => a.inDays - b.inDays),
  };
}

/* Debts ---------------------------------------------------------------------------- */
function logDebt({ person, amount, direction, note, currency } = {}) {
  if (!person || !amount) throw new Error("Who, and how much?");
  const dir = /i_owe|i owe|me_to|owe them/i.test(direction || "") ? "i_owe" : "owes_me";
  T.debts.push({ id: makeId(), person: String(person).trim(), amount: Number(amount), currency: String(currency || state.currency).toUpperCase().slice(0, 3), direction: dir, note: String(note || "").slice(0, 100), at: new Date().toISOString(), settled: false });
  saveTrackers();
  return debtsStatus();
}
function settleDebt({ person, amount } = {}) {
  const q = String(person || "").toLowerCase().trim();
  const open = T.debts.filter(d => !d.settled && d.person.toLowerCase().includes(q));
  if (!open.length) throw new Error(`Nothing open with ${person}.`);
  let left = amount ? Number(amount) : Infinity;
  for (const d of open) {
    if (left <= 0) break;
    if (d.amount <= left) { left -= d.amount; d.settled = true; }
    else { d.amount = Math.round((d.amount - left) * 100) / 100; left = 0; }
  }
  saveTrackers();
  return debtsStatus();
}
function debtsStatus() {
  const byPerson = {};
  for (const d of T.debts.filter(x => !x.settled)) {
    const k = `${d.person}|${d.currency}`;
    byPerson[k] = (byPerson[k] || 0) + (d.direction === "owes_me" ? d.amount : -d.amount);
  }
  const rows = Object.entries(byPerson).filter(([, v]) => Math.abs(v) > 0.001).map(([k, v]) => {
    const [person, cur] = k.split("|");
    return v > 0 ? { person, owesYou: money(v, cur) } : { person, youOwe: money(-v, cur) };
  });
  return { open: rows.length ? rows : "all square" };
}

/* Goals ------------------------------------------------------------------------------ */
function findGoal(name) {
  const q = String(name || "").toLowerCase();
  return T.goals.find(g => g.name.toLowerCase() === q) || T.goals.find(g => g.name.toLowerCase().includes(q) || q.includes(g.name.toLowerCase()));
}
function goalView(g) {
  const pct = Math.min(100, Math.round(g.progress / g.target * 100));
  const out = { name: g.name, progress: `${g.progress} / ${g.target}${g.unit ? " " + g.unit : ""}`, percent: pct };
  if (g.deadline) {
    const days = Math.round((new Date(g.deadline) - startOfDay()) / 86400000);
    out.daysLeft = days;
    if (days > 0 && pct < 100) {
      const perDay = (g.target - g.progress) / days;
      if (days <= 14) out.neededPerDay = Math.round(perDay * 10) / 10;
      else out.neededPerWeek = Math.round(perDay * 7 * 10) / 10;
    }
  }
  return out;
}
function setGoal({ name, target, unit, deadline, progress } = {}) {
  if (!name || !target) throw new Error("A name and a target.");
  const existing = findGoal(name);
  const g = existing || { id: makeId(), name: String(name).trim().slice(0, 60), at: new Date().toISOString(), progress: 0 };
  Object.assign(g, { target: Number(target), unit: String(unit || g.unit || "").slice(0, 20), deadline: deadline || g.deadline || null });
  if (progress !== undefined) g.progress = Number(progress);
  if (!existing) T.goals.push(g);
  saveTrackers();
  return goalView(g);
}
function updateGoal({ name, add, set } = {}) {
  const g = findGoal(name);
  if (!g) throw new Error(`No goal called "${name}".`);
  g.progress = set !== undefined && set !== null ? Number(set) : Math.round((g.progress + Number(add || 0)) * 100) / 100;
  saveTrackers();
  const v = goalView(g);
  if (v.percent >= 100) v.achieved = true;
  return v;
}

/* Reports ------------------------------------------------------------------------------ */
function healthReport({ tracker = "all", period = "week" } = {}) {
  const days = periodDays(period);
  const out = { period };
  const want = k => tracker === "all" || tracker === k;
  if (want("water")) {
    const first = Object.keys(T.water.days).sort()[0] || localDayKey();
    const recent = Array.from({ length: Math.min(days, 30) }, (_, i) => localDayKey(new Date(since(i))))
      .filter(k => k >= first).map(k => T.water.days[k] || 0);
    out.water = { today: `${recent[0]}/${T.water.goal}`, dailyAverage: Math.round(recent.reduce((a, b) => a + b, 0) / recent.length * 10) / 10, daysHitGoal: recent.filter(n => n >= T.water.goal).length };
  }
  if (want("workouts")) {
    const ws = T.workouts.filter(w => new Date(w.at) >= since(days));
    const byType = {};
    ws.forEach(w => { const t = byType[w.type] || (byType[w.type] = { sessions: 0, minutes: 0, km: 0 }); t.sessions++; t.minutes += w.minutes || 0; t.km += w.distanceKm || 0; });
    out.workouts = { sessions: ws.length, totalTime: hmMin(ws.reduce((s, w) => s + (w.minutes || 0), 0)), byType };
  }
  if (want("weight")) out.weight = logWeightView();
  if (want("mood")) {
    const ms = T.mood.filter(m => new Date(m.at) >= since(days));
    if (ms.length) {
      const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10;
      const byDay = {};
      ms.forEach(m => { const d = new Date(m.at).toLocaleDateString("en-GB", { weekday: "long" }); (byDay[d] || (byDay[d] = [])).push(m.score); });
      const sorted = Object.entries(byDay).map(([d, s]) => [d, avg(s)]).sort((a, b) => a[1] - b[1]);
      out.mood = { average: avg(ms.map(m => m.score)), energy: ms.some(m => m.energy) ? avg(ms.filter(m => m.energy).map(m => m.energy)) : undefined, lowestDay: sorted[0][0], bestDay: sorted[sorted.length - 1][0], recentNotes: ms.slice(-3).map(m => m.note).filter(Boolean) };
    } else out.mood = "nothing logged";
  }
  if (want("meds")) out.meds = medStatusToday();
  if (want("sleep") && typeof sleepReport === "function") out.sleep = sleepReport({ days });
  return out;
}
function logWeightView() {
  const latest = T.weight[T.weight.length - 1];
  return latest ? { latest: `${latest.kg} kg`, changeThisWeek: weightChange(7), changeThisMonth: weightChange(30), goal: T.weightGoal } : "nothing logged";
}
function ledgerReport({ tracker = "all" } = {}) {
  const want = k => tracker === "all" || tracker === k;
  const out = {};
  if (want("bills")) out.bills = billsStatus();
  if (want("debts")) out.debts = debtsStatus();
  if (want("goals")) out.goals = T.goals.map(goalView);
  if (want("car")) out.car = { ...carStats(), serviceEveryKm: T.car.serviceEveryKm };
  if (want("spending")) out.spendingThisMonth = expenseReport({ period: "month" }).totals;
  return out;
}

/* Jarvis notices: only what's worth a word ------------------------------------------- */
function trackerNudges() {
  const out = [];
  const now = new Date();
  const h = now.getHours();
  const water = T.water.days[localDayKey()] || 0;
  if (h >= 15 && Object.keys(T.water.days).length && water < T.water.goal / 2) out.push(`water ${water}/${T.water.goal} (behind)`);
  const missed = medStatusToday().flatMap(m => m.doses.filter(d => d.includes("MISSED")).map(d => `${m.name} ${d.slice(0, 5)}`));
  if (missed.length) out.push(`missed meds: ${missed.join(", ")}`);
  const dueSoon = billsStatus().bills.filter(b => b.inDays <= 2);
  if (dueSoon.length) out.push(`bills due: ${dueSoon.map(b => `${b.name} ${b.inDays === 0 ? "today" : `in ${b.inDays}d`} (${b.amount})`).join("; ")}`);
  const car = carStats();
  if (car.kmToService !== undefined && car.kmToService < 500) out.push(`car service ${car.kmToService <= 0 ? "overdue" : `due in ${car.kmToService} km`}`);
  const deadline = T.goals.map(goalView).filter(g => g.daysLeft !== undefined && g.daysLeft >= 0 && g.daysLeft <= 7 && g.percent < 100);
  if (deadline.length) out.push(`goal deadlines: ${deadline.map(g => `${g.name} ${g.percent}% with ${g.daysLeft}d left`).join("; ")}`);
  return out;
}
const morePromptLines = presencePromptLines;
presencePromptLines = function () {
  const out = morePromptLines();
  const n = trackerNudges();
  if (n.length) out.push(`Trackers worth a word (mention once, only if it fits): ${n.join(" · ")}.`);
  return out;
};

/* Instant, offline logging for the most common ones ----------------------------------- */
const QUICK_WATER = /^(i )?(just )?(drank|had|finished) (a |one |another |1 |two |2 )?(glass|glasses|cup|bottle)s? of water$|^water \+?(\d)$|^شربت (كوباية|كوب) (مية|ماء)$/i;
const QUICK_MEDS = /^(i )?(just )?took (my )?(pills|meds|medicine|medication|tablets)$|^خدت الدوا$/i;
const presenceFast = fastCommand;
fastCommand = async function (text) {
  const t = String(text).trim().replace(/^jarvis[,\s]+/i, "").replace(/[.!]+$/, "");
  if (QUICK_WATER.test(t)) {
    const n = /two|2/.test(t) ? 2 : Number((t.match(/^water \+?(\d)$/i) || [])[1]) || 1;
    const r = await logWater({ glasses: n });
    logActivity(`WATER +${n}`);
    return r.remaining ? `Noted. ${r.today} of ${r.goal} today, ${state.address}.` : `That's ${r.today} of ${r.goal}. Goal met, ${state.address}.`;
  }
  if (QUICK_MEDS.test(t) && T.meds.length) {
    const r = medTaken({});
    logActivity("MEDS TAKEN");
    return Array.isArray(r.marked) ? `Marked: ${r.marked.join(", ")}.` : `Nothing outstanding, ${state.address}. You're up to date.`;
  }
  return presenceFast(text);
};

/* Backup & restore ----------------------------------------------------------------------- */
const SECRET_KEYS = /^jarvis:(apiKey|elevenLabsApiKey|oauthClientSecret|calendarAccessToken|calendarRefreshToken|voiceClips)$/;
async function exportBackup() {
  const { keys } = await Preferences.keys();
  const data = {};
  for (const k of keys.filter(k => k.startsWith("jarvis:") && !SECRET_KEYS.test(k))) {
    const { value } = await Preferences.get({ key: k });
    data[k] = value;
  }
  const payload = JSON.stringify({ app: "jarvis", version: 1, exportedAt: new Date().toISOString(), data });
  const name = `jarvis-backup-${localDayKey()}.json`;
  if (Filesystem) {
    const { uri } = await Filesystem.writeFile({ path: name, data: payload, directory: "CACHE", encoding: "utf8" });
    await Share.share({ title: "Jarvis backup", text: "Jarvis backup (keys and passwords not included)", files: [uri] });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    a.download = name;
    a.click();
  }
  return { exported: Object.keys(data).length };
}
async function restoreBackup(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("That file isn't a Jarvis backup."); }
  if (!parsed || parsed.app !== "jarvis" || !parsed.data) throw new Error("That file isn't a Jarvis backup.");
  const keys = Object.keys(parsed.data).filter(k => k.startsWith("jarvis:") && !SECRET_KEYS.test(k));
  if (!confirm(`Restore ${keys.length} items from ${new Date(parsed.exportedAt).toLocaleString()}? This replaces your current reminders, notes, trackers and settings (your API keys stay).`)) return false;
  for (const k of keys) await Preferences.set({ key: k, value: parsed.data[k] });
  return true;
}

/* Trackers tab ----------------------------------------------------------------------------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function sparkline(values) {
  if (values.length < 2) return null;
  const w = 220, h = 40, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1) * w).toFixed(1)},${(h - 4 - (v - min) / span * (h - 8)).toFixed(1)}`).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("class", "spark");
  svg.setAttribute("preserveAspectRatio", "none");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", pts);
  svg.appendChild(line);
  return svg;
}
function statRow(label, value, warn) {
  const r = el("div", "stat-row");
  r.append(el("span", "stat-label", label), el("span", warn ? "stat-value warn" : "stat-value", value));
  return r;
}

function renderTrackers() {
  const box = id => { const b = document.getElementById(id); if (b) b.innerHTML = ""; return b; };
  // Water
  const w = box("waterBox");
  if (w) {
    const today = T.water.days[localDayKey()] || 0;
    const dots = el("div", "water-dots");
    for (let i = 0; i < Math.max(T.water.goal, today); i++) {
      const d = el("button", i < today ? "water-dot full" : "water-dot");
      d.setAttribute("aria-label", `glass ${i + 1}`);
      d.addEventListener("click", () => { logWater({ glasses: 1, undo: i < today }); buzz("light"); });
      dots.appendChild(d);
    }
    w.append(statRow("Today", `${today} / ${T.water.goal} glasses`), dots);
  }
  // Meds
  const m = box("medsBox");
  if (m) {
    if (!T.meds.length) m.append(el("div", "empty-hint", '"Remind me to take vitamin D at 9 am" and he keeps track.'));
    medStatusToday().forEach(med => med.doses.forEach(dose => {
      const row = el("div", "list-item");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = dose.includes("taken");
      const time = dose.slice(0, 5);
      cb.addEventListener("change", () => {
        const md = T.meds.find(x => x.name === med.name);
        const day = localDayKey();
        const taken = md.taken[day] || (md.taken[day] = []);
        if (cb.checked && !taken.includes(time)) taken.push(time);
        if (!cb.checked) md.taken[day] = taken.filter(t => t !== time);
        saveTrackers();
        buzz(cb.checked ? "success" : "light");
      });
      row.append(cb, el("span", "", `${med.name} · ${time}`), el("span", dose.includes("MISSED") ? "activity-time warn-text" : "activity-time", dose.slice(6)));
      m.appendChild(row);
    }));
  }
  // Fitness
  const f = box("fitnessBox");
  if (f) {
    const week = T.workouts.filter(x => new Date(x.at) >= since(7));
    f.append(statRow("Workouts this week", `${week.length} · ${hmMin(week.reduce((s, x) => s + (x.minutes || 0), 0))}`));
    const lw = T.weight[T.weight.length - 1];
    if (lw) {
      const ch = weightChange(30);
      f.append(statRow("Weight", `${lw.kg} kg${ch !== null ? ` (${ch > 0 ? "+" : ""}${ch} this month)` : ""}${T.weightGoal ? ` → ${T.weightGoal}` : ""}`));
      const s = sparkline(T.weight.slice(-30).map(x => x.kg));
      if (s) f.appendChild(s);
    }
    const moods = T.mood.filter(x => new Date(x.at) >= since(7));
    if (moods.length) f.append(statRow("Mood this week", `${Math.round(moods.reduce((a, x) => a + x.score, 0) / moods.length * 10) / 10} / 10`));
    if (typeof sleepReport === "function") { const s = sleepReport({ days: 7 }); if (s.nights) f.append(statRow("Sleep (avg)", s.average)); }
    if (!T.workouts.length && !lw && !moods.length) f.append(el("div", "empty-hint", '"I ran 5 km in 30 minutes", "I weigh 82", "feeling 7 out of 10".'));
  }
  // Money
  const mo = box("moneyBox");
  if (mo) {
    const bills = billsStatus();
    if (T.bills.length) mo.append(statRow("Monthly bills", bills.monthlyTotal));
    bills.bills.slice(0, 4).forEach(b => mo.append(statRow(b.name, `${b.amount} · ${b.inDays === 0 ? "due today" : `in ${b.inDays}d`}`, b.inDays <= 2)));
    const debts = debtsStatus();
    if (Array.isArray(debts.open)) debts.open.forEach(d => mo.append(statRow(d.person, d.owesYou ? `owes you ${d.owesYou}` : `you owe ${d.youOwe}`)));
    if (!T.bills.length && !T.debts.length) mo.append(el("div", "empty-hint", '"Internet bill is 450 on the 5th", "Ahmed owes me 500".'));
  }
  // Goals
  const g = box("goalsBox");
  if (g) {
    if (!T.goals.length) g.append(el("div", "empty-hint", '"Goal: save 20000 for a laptop by March".'));
    T.goals.map(goalView).forEach(v => {
      const row = el("div", "goal-row");
      const bar = el("div", "goal-bar");
      const fill = el("span");
      fill.style.width = `${v.percent}%`;
      bar.appendChild(fill);
      row.append(statRow(v.name, `${v.progress} · ${v.percent}%`), bar);
      g.appendChild(row);
    });
  }
  // Car
  const c = box("carBox");
  if (c) {
    const s = carStats();
    if (!T.car.fuel.length && !T.car.lastServiceKm) c.append(el("div", "empty-hint", '"Filled 40 liters for 700, odometer 52300".'));
    if (s.kmPerLiter) c.append(statRow("Economy", `${s.kmPerLiter} km/L`));
    if (s.costPerKm) c.append(statRow("Cost", `${s.costPerKm} ${state.currency}/km`));
    if (T.car.fuel.length) c.append(statRow("Fuel this month", s.fuelThisMonth));
    if (s.kmToService !== undefined) c.append(statRow("Next service", s.kmToService <= 0 ? "overdue" : `in ${s.kmToService} km`, s.kmToService < 500));
  }
  if (typeof renderLife === "function") renderLife();
}

/* Tools ------------------------------------------------------------------------------------- */
const xn = { type: "number" };
FEATURE_TOOLS.push(
  xfn("log_water", "Log glasses of water (or undo), and/or set the daily goal or hydration reminders.", { glasses: { type: "integer" }, undo: { type: "boolean" }, goal: { type: "integer" }, reminders: { type: "boolean" } }),
  xfn("log_workout", "Log exercise: type (run, gym, walk, bench press, football…), with any of duration, distance, sets/reps/weight.", { type: xs, minutes: xn, distance_km: xn, sets: { type: "integer" }, reps: { type: "integer" }, weight_kg: xn, note: xs }, ["type"]),
  xfn("log_weight", "Log body weight in kg and/or set a goal weight.", { kg: xn, goal_kg: xn }),
  xfn("log_mood", "Log mood (1-10), optionally energy (1-10) and a note.", { score: { type: "integer" }, energy: { type: "integer" }, note: xs }, ["score"]),
  xfn("add_medication", "Save a medication with daily reminder times (updates it if it exists).", { name: xs, dose: xs, times: { type: "array", items: xs, description: "HH:MM" } }, ["name", "times"]),
  xfn("med_taken", "Mark medication taken (a named one, or everything currently due).", { name: xs, time: { type: "string", description: "HH:MM dose, if specific" } }),
  xfn("remove_medication", "Stop tracking a medication.", { name: xs }, ["name"]),
  xfn("health_report", "Report on water, workouts, weight, mood, meds and sleep.", { tracker: { type: "string", enum: ["all", "water", "workouts", "weight", "mood", "meds", "sleep"] }, period: { type: "string", enum: ["today", "week", "month", "year"] } }),
  xfn("log_fuel", "Log a car fill-up: liters, cost, odometer (km). Cost also goes to spending.", { liters: xn, cost: xn, odometer: xn }),
  xfn("log_service", "Log a car service at an odometer reading, and/or set the service interval in km.", { odometer: xn, every_km: xn }),
  xfn("add_bill", "Add a monthly bill or subscription with its due day (reminded the day before).", { name: xs, amount: xn, due_day: { type: "integer" }, currency: xs }, ["name", "amount", "due_day"]),
  xfn("bill_paid", "Mark a bill paid for this cycle (also logs the spending).", { name: xs }, ["name"]),
  xfn("remove_bill", "Remove a bill.", { name: xs }, ["name"]),
  xfn("log_debt", "Record money lent or borrowed. direction: owes_me (they owe the user) or i_owe.", { person: xs, amount: xn, direction: { type: "string", enum: ["owes_me", "i_owe"] }, note: xs, currency: xs }, ["person", "amount", "direction"]),
  xfn("settle_debt", "Settle a debt with someone, fully or a partial amount.", { person: xs, amount: xn }, ["person"]),
  xfn("set_goal", "Create or change a goal with a numeric target (and optional unit and deadline YYYY-MM-DD).", { name: xs, target: xn, unit: xs, deadline: xs, progress: xn }, ["name", "target"]),
  xfn("update_goal", "Add progress to a goal, or set its progress.", { name: xs, add: xn, set: xn }, ["name"]),
  xfn("ledger_report", "Bills, debts, goals, car and spending overview.", { tracker: { type: "string", enum: ["all", "bills", "debts", "goals", "car", "spending"] } }),
);
Object.assign(FEATURE_HANDLERS, {
  log_water: a => logWater(a), log_workout: a => logWorkout(a), log_weight: a => logWeight(a), log_mood: a => logMood(a),
  add_medication: a => addMedication(a), med_taken: a => medTaken(a), remove_medication: a => removeMedication(a), health_report: a => healthReport(a),
  log_fuel: a => logFuel(a), log_service: a => logService(a), add_bill: a => addBill(a), bill_paid: a => billPaid(a), remove_bill: a => removeBill(a),
  log_debt: a => logDebt(a), settle_debt: a => settleDebt(a), set_goal: a => setGoal(a), update_goal: a => updateGoal(a), ledger_report: a => ledgerReport(a),
});
Object.assign(FEATURE_LABELS, {
  log_water: a => a.goal ? `WATER GOAL ${a.goal}` : `WATER +${a.glasses || 1}`, log_workout: a => `WORKOUT LOGGED: ${a.type || ""}`,
  log_weight: a => a.kg ? `WEIGHT ${a.kg} KG` : "WEIGHT GOAL SET", log_mood: a => `MOOD ${a.score}/10`,
  add_medication: a => `MEDICATION: ${a.name || ""}`, med_taken: a => `TAKEN: ${a.name || "due doses"}`, remove_medication: a => `REMOVED: ${a.name || ""}`,
  health_report: a => `HEALTH REPORT: ${a.tracker || "all"}`, log_fuel: () => "FUEL LOGGED", log_service: () => "SERVICE LOGGED",
  add_bill: a => `BILL: ${a.name || ""}`, bill_paid: a => `PAID: ${a.name || ""}`, remove_bill: a => `BILL REMOVED: ${a.name || ""}`,
  log_debt: a => `LEDGER: ${a.person || ""}`, settle_debt: a => `SETTLED: ${a.person || ""}`, set_goal: a => `GOAL: ${a.name || ""}`,
  update_goal: a => `GOAL PROGRESS: ${a.name || ""}`, ledger_report: a => `LEDGER: ${a.tracker || "all"}`,
});
Object.assign(TOOL_GROUPS, {
  health: {
    about: "water, workouts, weight, mood, medications and health reports",
    tools: ["log_water", "log_workout", "log_weight", "log_mood", "add_medication", "med_taken", "remove_medication", "health_report"],
    match: /\b(water|hydrat\w*|drank|glass(es)?|workout|work out|worked out|exercise|gym|run|ran|jog|walk(ed)?|swim|swam|push-?ups?|squats?|bench|deadlift|reps?|sets?|km|weigh|weight|kg|kilos?|mood|feeling|felt|stressed|anxious|happy|sad|tired|energy|pills?|meds|medication|medicine|tablets?|vitamins?|dose|health|tracker|trackers|weekly report)\b|مية|شربت|تمرين|الجيم|وزني|مزاجي|دوا/i,
  },
  ledger: {
    about: "bills and subscriptions, debts (who owes whom), savings and other goals, car fuel and service",
    tools: ["log_fuel", "log_service", "add_bill", "bill_paid", "remove_bill", "log_debt", "settle_debt", "set_goal", "update_goal", "ledger_report"],
    match: /\b(bill|bills|subscription|subscriptions|rent|internet|electricity|netflix|due|owes?|owed|lent|borrow\w*|paid (him|her|them|back)|pay (him|her|them) back|debt|debts|goal|goals|save up|saving|savings|target|fuel|petrol|benzine|gas|filled|fill-?up|odometer|oil change|service|car)\b|فاتورة|اشتراك|سلف|دين|بنزين|العربية/i,
  },
});

/* Init ------------------------------------------------------------------------------------- */
async function initTrackers() {
  const saved = await store.get("trackers", null);
  if (saved) for (const k of Object.keys(T)) if (saved[k] !== undefined) T[k] = saved[k];
  renderTrackers();
  scheduleBillReminders().catch(() => {});
  const exp = document.getElementById("exportBackupBtn");
  if (exp) exp.addEventListener("click", () => exportBackup().then(r => toast(`Backup ready: ${r.exported} items`)).catch(e => toast(e.message, 4000)));
  const imp = document.getElementById("restoreBackupInput");
  const impBtn = document.getElementById("restoreBackupBtn");
  if (imp && impBtn) {
    impBtn.addEventListener("click", () => imp.click());
    imp.addEventListener("change", async () => {
      const file = imp.files && imp.files[0];
      imp.value = "";
      if (!file) return;
      try { if (await restoreBackup(file)) { toast("Restored. Restarting…"); setTimeout(() => location.reload(), 900); } }
      catch (e) { toast(e.message, 4000); }
    });
  }
  // Refresh the tab when opened (missed doses change with the clock).
  const tab = document.querySelector('.tab[data-view="trackersView"]');
  if (tab) tab.addEventListener("click", renderTrackers);
}
