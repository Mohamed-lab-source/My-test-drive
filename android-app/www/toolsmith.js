/* ======================================================================
 * Jarvis 3.7 — the Toolsmith (30 everyday upgrades)
 *
 * A big box of practical tools. Most are pure-offline maths and text
 * helpers (tip, loan, age, zakat, pace, base/roman, word count, lists,
 * counters, timers, world clock…). A few go online only when they must
 * (live rates, crypto, holidays) — in keeping with "local first".
 * Loads after scribe.js, before offline.js. Content + light device only.
 * ====================================================================== */

Object.assign(state, { counters: {}, swatch: null });
const TS_TIMERS = [];
const TS_ADDR = () => state.address || "sir";
const tsRound = (n, d = 2) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };
const tsNum = (v, name) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`I need a number for ${name || "that"}.`); return n; };

/* ---- 1. Tip & split a bill ---------------------------------------------------- */
function tipCalc({ amount, tip_percent, split } = {}) {
  const bill = tsNum(amount, "the bill");
  const pct = clampNum(tip_percent, 0, 100, 12);
  const people = Math.max(1, Math.round(clampNum(split, 1, 100, 1)));
  const tip = tsRound(bill * pct / 100), total = tsRound(bill + tip);
  const out = { bill: tsRound(bill), tipPercent: pct, tip, total };
  if (people > 1) { out.split = people; out.perPerson = tsRound(total / people); }
  return out;
}

/* ---- 2. Discount / sale price ------------------------------------------------- */
function discountCalc({ price, percent_off } = {}) {
  const p = tsNum(price, "the price"), off = clampNum(percent_off, 0, 100, 0);
  const saved = tsRound(p * off / 100);
  return { original: tsRound(p), percentOff: off, youSave: saved, salePrice: tsRound(p - saved) };
}

/* ---- 3. Loan / instalment ----------------------------------------------------- */
function loanCalc({ amount, annual_rate, years } = {}) {
  const P = tsNum(amount, "the loan amount");
  const years_ = tsNum(years, "the term in years");
  const r = clampNum(annual_rate, 0, 200, 0) / 100 / 12;
  const n = Math.round(years_ * 12);
  const monthly = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  const total = monthly * n;
  return { amount: tsRound(P), annualRate: clampNum(annual_rate, 0, 200, 0), months: n, monthlyPayment: tsRound(monthly), totalPaid: tsRound(total), totalInterest: tsRound(total - P) };
}

/* ---- 4. Age from a birthdate -------------------------------------------------- */
function ageCalc({ birthdate } = {}) {
  const b = new Date(`${String(birthdate || "").trim()}T12:00:00`);
  if (isNaN(b)) throw new Error("Give me a birthdate like 1995-04-20.");
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  let m = now.getMonth() - b.getMonth();
  let d = now.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  const toBday = Math.ceil((next - now) / 86400000);
  return { age: `${y} years, ${m} months, ${d} days`, years: y, nextBirthdayInDays: toBday };
}

/* ---- 5. Zakat (2.5%) ---------------------------------------------------------- */
function zakatCalc({ savings, gold_value, business_value, debts } = {}) {
  const total = tsNum(savings || 0, "savings") + Number(gold_value || 0) + Number(business_value || 0) - Number(debts || 0);
  const zakatable = Math.max(0, total);
  return { netWealth: tsRound(zakatable), rate: "2.5%", zakatDue: tsRound(zakatable * 0.025), note: "Zakat is due on wealth held a full lunar year above nisab. Check nisab against the current gold/silver price." };
}

/* ---- 6. Daily calories (Mifflin–St Jeor) -------------------------------------- */
function calorieCalc({ weight_kg, height_cm, age, sex, activity } = {}) {
  let w = Number(weight_kg);
  if (!w && typeof T === "object" && T.weight && T.weight.length) w = T.weight[T.weight.length - 1].kg;
  const h = tsNum(height_cm, "height in cm"), a = tsNum(age, "age");
  if (!w) throw new Error("I need your weight (in kg).");
  const male = !/f|woman|female/i.test(sex || "m");
  const bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
  const f = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }[String(activity || "light").toLowerCase()] || 1.375;
  const tdee = bmr * f;
  return { bmr: Math.round(bmr), maintainCalories: Math.round(tdee), loseWeight: Math.round(tdee - 500), gainWeight: Math.round(tdee + 500), note: "Estimates. Adjust by results over a couple of weeks." };
}

/* ---- 7. Running pace ---------------------------------------------------------- */
function paceCalc({ distance_km, minutes, seconds } = {}) {
  const dist = tsNum(distance_km, "distance in km");
  const totalSec = tsNum(minutes, "the time in minutes") * 60 + Number(seconds || 0);
  if (dist <= 0) throw new Error("Distance must be above zero.");
  const perKm = totalSec / dist;
  const pace = `${Math.floor(perKm / 60)}:${pad2(Math.round(perKm % 60))} min/km`;
  return { distanceKm: dist, time: `${Math.floor(totalSec / 60)}:${pad2(Math.round(totalSec % 60))}`, pace, speedKmh: tsRound(dist / (totalSec / 3600), 1) };
}

/* ---- 8. Trip fuel cost -------------------------------------------------------- */
function fuelCost({ distance_km, consumption_l_per_100, price_per_liter } = {}) {
  const dist = tsNum(distance_km, "distance in km");
  const cons = tsNum(consumption_l_per_100, "consumption (L/100km)");
  const price = clampNum(price_per_liter, 0, 10000, 0);
  const liters = dist * cons / 100;
  return { distanceKm: dist, litersNeeded: tsRound(liters, 1), pricePerLiter: price, cost: tsRound(liters * price), currency: "EGP" };
}

/* ---- 9. Base conversion ------------------------------------------------------- */
function baseConvert({ value, from_base, to_base } = {}) {
  const fb = Math.round(clampNum(from_base, 2, 36, 10)), tb = Math.round(clampNum(to_base, 2, 36, 10));
  const n = parseInt(String(value || "").trim(), fb);
  if (isNaN(n)) throw new Error(`"${value}" isn't a valid base-${fb} number.`);
  return { input: String(value).trim(), fromBase: fb, toBase: tb, result: n.toString(tb).toUpperCase(), decimal: n };
}

/* ---- 10. Roman numerals (both ways) ------------------------------------------- */
const TS_ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function romanNumerals({ value } = {}) {
  const s = String(value || "").trim().toUpperCase();
  if (/^[0-9]+$/.test(s)) {
    let n = Number(s); if (n < 1 || n > 3999) throw new Error("Roman numerals cover 1 to 3999.");
    let out = ""; for (const [v, r] of TS_ROMAN) while (n >= v) { out += r; n -= v; }
    return { number: Number(s), roman: out };
  }
  if (/^[MDCLXVI]+$/.test(s)) {
    let n = 0, i = 0;
    for (const [v, r] of TS_ROMAN) { while (s.slice(i).startsWith(r)) { n += v; i += r.length; } }
    if (i !== s.length) throw new Error(`"${value}" isn't a valid Roman numeral.`);
    return { roman: s, number: n };
  }
  throw new Error("Give me a number (1–3999) or a Roman numeral.");
}

/* ---- 11. Word / character count ----------------------------------------------- */
function wordCount({ text } = {}) {
  const body = String(text || "").trim();
  if (!body) throw new Error("Give me some text.");
  const words = (body.match(/\S+/g) || []).length;
  const sentences = (body.match(/[.!?؟]+/g) || []).length || 1;
  return { words, characters: body.length, charactersNoSpaces: body.replace(/\s/g, "").length, sentences, readingMinutes: Math.max(1, Math.round(words / 200)) };
}

/* ---- 12. Change case ---------------------------------------------------------- */
function changeCase({ text, mode } = {}) {
  const body = String(text || ""); if (!body.trim()) throw new Error("Give me some text.");
  const m = String(mode || "sentence").toLowerCase();
  let out = body;
  if (m === "upper") out = body.toUpperCase();
  else if (m === "lower") out = body.toLowerCase();
  else if (m === "title") out = body.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  else out = body.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase());
  copyQuietlyTS(out);
  return { mode: m, result: out, note: "Copied." };
}

/* ---- 13. Text tools: sort / dedupe / reverse / shuffle lines ------------------ */
function textTools({ text, op } = {}) {
  let lines = String(text || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Give me a list (one item per line).");
  const o = String(op || "sort").toLowerCase();
  if (o === "sort") lines.sort((a, b) => a.localeCompare(b));
  else if (o === "dedupe") lines = [...new Set(lines)];
  else if (o === "reverse") lines.reverse();
  else if (o === "shuffle") for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  const result = lines.join("\n");
  copyQuietlyTS(result);
  return { op: o, count: lines.length, result, note: "Copied." };
}

/* ---- 14. Days between two dates ----------------------------------------------- */
function daysBetween({ from, to } = {}) {
  const a = new Date(`${String(from || "").trim()}T12:00:00`);
  const b = new Date(`${String(to || localDayKey()).trim()}T12:00:00`);
  if (isNaN(a) || isNaN(b)) throw new Error("Use dates like 2026-01-01.");
  const days = Math.round((b - a) / 86400000);
  return { from: localDayKey(a), to: localDayKey(b), days: Math.abs(days), weeks: tsRound(Math.abs(days) / 7, 1), direction: days < 0 ? "in the past" : "ahead" };
}

/* ---- 15–17. Lists (shopping / to-do / packing …) ------------------------------ */
function listAdd({ list, items } = {}) {
  const arr = String(items || "").split(/,|\n/).map(s => s.trim()).filter(Boolean);
  if (!arr.length) throw new Error("What should I add?");
  const r = addToList(list || "shopping", arr);
  return { list: r.list, added: r.added, total: r.count };
}
function listShow({ list } = {}) { return getList(list); }
function listClear({ list } = {}) {
  const key = (typeof listKey === "function" ? listKey(list || "shopping") : String(list || "shopping").toLowerCase());
  const had = (state.lists[key] || []).length;
  state.lists[key] = [];
  if (typeof saveLists === "function") saveLists();
  return { list: key, cleared: had };
}

/* ---- 18. Named counters (count anything) -------------------------------------- */
function counterTool({ name, action, by } = {}) {
  const k = String(name || "count").toLowerCase().trim();
  state.counters[k] = state.counters[k] || 0;
  const step = Math.round(clampNum(by, -1000, 1000, 1));
  const a = String(action || "add").toLowerCase();
  if (a === "reset") state.counters[k] = 0;
  else if (a === "subtract" || a === "minus" || a === "down") state.counters[k] -= step;
  else if (a === "show" || a === "check") { /* no change */ }
  else state.counters[k] += step;
  store.set("counters", state.counters);
  return { counter: k, value: state.counters[k] };
}

/* ---- 19. World clock (offline via IANA zones) --------------------------------- */
const TS_ZONES = { cairo: "Africa/Cairo", london: "Europe/London", "new york": "America/New_York", newyork: "America/New_York", dubai: "Asia/Dubai", "abu dhabi": "Asia/Dubai", jeddah: "Asia/Riyadh", riyadh: "Asia/Riyadh", mecca: "Asia/Riyadh", makkah: "Asia/Riyadh", tokyo: "Asia/Tokyo", paris: "Europe/Paris", berlin: "Europe/Berlin", istanbul: "Europe/Istanbul", moscow: "Europe/Moscow", "los angeles": "America/Los_Angeles", la: "America/Los_Angeles", "san francisco": "America/Los_Angeles", chicago: "America/Chicago", toronto: "America/Toronto", sydney: "Australia/Sydney", singapore: "Asia/Singapore", "hong kong": "Asia/Hong_Kong", mumbai: "Asia/Kolkata", delhi: "Asia/Kolkata", india: "Asia/Kolkata", beijing: "Asia/Shanghai", china: "Asia/Shanghai", doha: "Asia/Qatar", kuwait: "Asia/Kuwait", amman: "Asia/Amman", beirut: "Asia/Beirut", casablanca: "Africa/Casablanca", lagos: "Africa/Lagos", nairobi: "Africa/Nairobi", madrid: "Europe/Madrid", rome: "Europe/Rome", washington: "America/New_York", utc: "UTC" };
function worldClock({ city } = {}) {
  const key = String(city || "").toLowerCase().replace(/[?.]/g, "").trim();
  const tz = TS_ZONES[key] || (/^[a-z]+\/[a-z_]+$/i.test(city || "") ? city : null);
  if (!tz) throw new Error(`I don't know the time zone for "${city}". Try a major city.`);
  const now = new Date();
  const time = now.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });
  const here = now.toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
  return { city: city, zone: tz, localTime: time, cairoTime: here };
}

/* ---- 20. Countdown timer (while the app is open) ------------------------------ */
function timerTool({ minutes, label } = {}) {
  const mins = clampNum(minutes, 0.1, 600, 5);
  const ms = Math.round(mins * 60000);
  const name = String(label || "").trim() || "timer";
  const when = Date.now() + ms;
  const id = setTimeout(async () => {
    try { buzz("heavy"); } catch {}
    try { await speak(`${name === "timer" ? "Timer" : "Your " + name + " timer"} is up, ${TS_ADDR()}.`); } catch {}
    const i = TS_TIMERS.findIndex(x => x.id === id); if (i >= 0) TS_TIMERS.splice(i, 1);
  }, ms);
  TS_TIMERS.push({ id, name, when });
  return { set: name, minutes: mins, ringsAt: new Date(when).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), note: "I'll chime while the app is open. For alarms when it's closed, set a reminder." };
}

/* ---- 21. Stopwatch ------------------------------------------------------------ */
function stopwatchTool({ action } = {}) {
  const a = String(action || "start").toLowerCase();
  if (a === "start") { state.swatch = { started: Date.now(), laps: [] }; store.set("swatch", state.swatch); return { stopwatch: "started" }; }
  if (!state.swatch) throw new Error("The stopwatch isn't running.");
  const elapsed = Date.now() - state.swatch.started;
  const fmt = ms => `${Math.floor(ms / 60000)}:${pad2(Math.floor(ms / 1000) % 60)}`;
  if (a === "lap") { state.swatch.laps.push(elapsed); store.set("swatch", state.swatch); return { lap: state.swatch.laps.length, at: fmt(elapsed) }; }
  if (a === "stop" || a === "reset") { const r = { stopped: fmt(elapsed), laps: state.swatch.laps.map(fmt) }; state.swatch = null; store.set("swatch", null); return r; }
  return { running: true, elapsed: fmt(elapsed), laps: state.swatch.laps.length };
}

/* ---- 22. Dua (offline collection) --------------------------------------------- */
const TS_DUAS = [
  { ar: "اللّهُمَّ إنّي أسألُكَ العفوَ والعافيةَ في الدنيا والآخرة", en: "O Allah, I ask You for pardon and well-being in this world and the next.", for: "well-being" },
  { ar: "رَبِّ اشرَح لي صَدري ويَسِّر لي أمري", en: "My Lord, expand my chest and ease my task for me.", for: "ease / stress" },
  { ar: "اللّهُمَّ إنّي أعوذُ بكَ منَ الهمِّ والحزَن", en: "O Allah, I seek refuge in You from anxiety and grief.", for: "worry" },
  { ar: "حَسبيَ اللّهُ لا إلهَ إلا هو عليهِ توكّلتُ وهو ربُّ العرشِ العظيم", en: "Allah is sufficient for me; there is no god but He. In Him I trust.", for: "reliance" },
  { ar: "رَبِّ زِدني عِلمًا", en: "My Lord, increase me in knowledge.", for: "study" },
  { ar: "اللّهُمَّ بارِك لنا فيما رزقتَنا", en: "O Allah, bless for us what You have provided us.", for: "gratitude / food" },
  { ar: "رَبَّنا آتِنا في الدنيا حسنةً وفي الآخرةِ حسنةً وقِنا عذابَ النار", en: "Our Lord, give us good in this world and the next, and protect us from the Fire.", for: "general" },
  { ar: "اللّهُمَّ اهدِني وسَدِّدني", en: "O Allah, guide me and keep me on the straight path.", for: "guidance" },
];
function duaTool({ topic } = {}) {
  const t = String(topic || "").toLowerCase();
  const pool = t ? TS_DUAS.filter(d => d.for.includes(t) || d.en.toLowerCase().includes(t)) : TS_DUAS;
  const d = (pool.length ? pool : TS_DUAS)[Math.floor(Math.random() * (pool.length ? pool.length : TS_DUAS.length))];
  return { arabic: d.ar, english: d.en, for: d.for };
}

/* ---- 23. Currency conversion (live) ------------------------------------------- */
async function currencyConvert({ amount, from, to } = {}) {
  const amt = clampNum(amount, 0, 1e12, 1);
  const f = String(from || "USD").toUpperCase().trim(), t = String(to || "EGP").toUpperCase().trim();
  let data;
  try { data = await httpGetJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(f)}`); }
  catch { throw new Error("I couldn't reach the exchange rates just now."); }
  const rate = data && data.rates && data.rates[t];
  if (!rate) throw new Error(`I don't have a rate for ${f}→${t}.`);
  return { amount: amt, from: f, to: t, rate: tsRound(rate, 4), result: tsRound(amt * rate), asOf: data.time_last_update_utc };
}

/* ---- 24. Crypto price (live) -------------------------------------------------- */
async function cryptoPrice({ coin } = {}) {
  const map = { btc: "bitcoin", bitcoin: "bitcoin", eth: "ethereum", ethereum: "ethereum", bnb: "binancecoin", sol: "solana", solana: "solana", xrp: "ripple", ada: "cardano", doge: "dogecoin" };
  const id = map[String(coin || "bitcoin").toLowerCase().trim()] || String(coin || "bitcoin").toLowerCase().trim();
  let data;
  try { data = await httpGetJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,egp&include_24hr_change=true`); }
  catch { throw new Error("I couldn't reach the crypto prices just now."); }
  const d = data && data[id];
  if (!d) throw new Error(`I don't recognise the coin "${coin}".`);
  return { coin: id, usd: d.usd, egp: d.egp, change24h: d.usd_24h_change != null ? tsRound(d.usd_24h_change, 2) + "%" : null };
}

/* ---- 25. IP / connection info (live) ------------------------------------------ */
async function ipInfo() {
  let data;
  try { data = await httpGetJson("https://ipwho.is/"); }
  catch { throw new Error("I couldn't look that up just now."); }
  if (!data || data.success === false) throw new Error("Couldn't read the connection details.");
  return { ip: data.ip, city: data.city, country: data.country, isp: data.connection && data.connection.isp, timezone: data.timezone && data.timezone.id };
}

/* ---- 26. Number fact ---------------------------------------------------------- */
async function numberFact({ number } = {}) {
  const n = Number.isFinite(Number(number)) ? Math.round(Number(number)) : "random";
  try { const d = await httpGetJson(`https://numbersapi.com/${n}/trivia?json`); return { number: d.number, fact: d.text }; }
  catch { throw new Error("I couldn't fetch a fact just now."); }
}

/* ---- 27. Public holidays (Egypt) ---------------------------------------------- */
async function egyptHolidays({ year, country } = {}) {
  const y = Math.round(clampNum(year, 1975, 2100, new Date().getFullYear()));
  const c = String(country || "EG").toUpperCase().slice(0, 2);
  let data;
  try { data = await httpGetJson(`https://date.nager.at/api/v3/PublicHolidays/${y}/${c}`); }
  catch { throw new Error("I couldn't reach the holidays list just now."); }
  if (!Array.isArray(data)) throw new Error(`No holiday data for ${c} ${y}.`);
  const today = localDayKey();
  const upcoming = data.filter(h => h.date >= today).slice(0, 8);
  return { year: y, country: c, total: data.length, next: (upcoming.length ? upcoming : data.slice(0, 8)).map(h => ({ date: h.date, name: h.localName || h.name })) };
}

/* ---- 28. Sunrise / sunset ----------------------------------------------------- */
async function sunriseSunset({ place } = {}) {
  let lat = 30.0444, lon = 31.2357, label = "Cairo";
  try { if (typeof resolvePlace === "function" && place) { const w = await resolvePlace(place); if (w && w.lat) { lat = w.lat; lon = w.lon; label = w.label || place; } } } catch {}
  let data;
  try { data = await httpGetJson(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`); }
  catch { throw new Error("I couldn't reach the sunrise data just now."); }
  if (!data || data.status !== "OK") throw new Error("Couldn't read the sunrise times.");
  const fmt = iso => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
  return { place: label, sunrise: fmt(data.results.sunrise), sunset: fmt(data.results.sunset), dayLength: data.results.day_length };
}

/* ---- 29. Random fact ---------------------------------------------------------- */
async function randomFact() {
  try { const d = await httpGetJson("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"); return { fact: d.text }; }
  catch { throw new Error("I couldn't fetch a fact just now."); }
}

/* ---- 30. Best-value / unit price ---------------------------------------------- */
function unitPriceCompare({ options } = {}) {
  const rows = String(options || "").split(/\n|;/).map(s => s.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(.+?)[\s:]+(\d+(?:\.\d+)?)\s*(?:for|@|\/|,)?\s*(\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const price = Number(m[2]), qty = Number(m[3]);
    return qty > 0 ? { label: m[1].trim(), price, qty, unit: tsRound(price / qty, 4) } : null;
  }).filter(Boolean);
  if (rows.length < 2) throw new Error('Give me options like "big: 50 for 2, small: 30 for 1" (one per line or comma).');
  rows.sort((a, b) => a.unit - b.unit);
  return { best: rows[0].label, bestUnitPrice: rows[0].unit, ranked: rows.map(r => ({ label: r.label, perUnit: r.unit })) };
}

async function copyQuietlyTS(text) { try { await Clipboard.write({ string: text }); } catch {} }

/* ===== Registration ============================================================ */
FEATURE_TOOLS.push(
  xfn("tip_calc", "Work out a tip and split a bill between people.", { amount: xn, tip_percent: xn, split: { type: "integer" } }, ["amount"]),
  xfn("discount_calc", "Work out a sale price and how much is saved from a percent off.", { price: xn, percent_off: xn }, ["price", "percent_off"]),
  xfn("loan_calc", "Monthly instalment, total paid and interest on a loan.", { amount: xn, annual_rate: xn, years: xn }, ["amount", "annual_rate", "years"]),
  xfn("age_calc", "Exact age from a birthdate, and days until the next birthday.", { birthdate: xs }, ["birthdate"]),
  xfn("zakat_calc", "Calculate zakat (2.5%) on savings, gold and business value, minus debts.", { savings: xn, gold_value: xn, business_value: xn, debts: xn }, ["savings"]),
  xfn("calorie_calc", "Daily calories to maintain, lose or gain weight (Mifflin–St Jeor).", { weight_kg: xn, height_cm: xn, age: { type: "integer" }, sex: { type: "string", enum: ["male", "female"] }, activity: { type: "string", enum: ["sedentary", "light", "moderate", "active", "athlete"] } }, ["height_cm", "age"]),
  xfn("pace_calc", "Running pace and speed from a distance and a time.", { distance_km: xn, minutes: xn, seconds: xn }, ["distance_km", "minutes"]),
  xfn("fuel_cost", "Fuel needed and cost for a trip.", { distance_km: xn, consumption_l_per_100: xn, price_per_liter: xn }, ["distance_km", "consumption_l_per_100", "price_per_liter"]),
  xfn("base_convert", "Convert a number between bases (2–36): binary, hex, decimal…", { value: xs, from_base: { type: "integer" }, to_base: { type: "integer" } }, ["value", "from_base", "to_base"]),
  xfn("roman_numerals", "Convert a number to a Roman numeral or back.", { value: xs }, ["value"]),
  xfn("word_count", "Count words, characters, sentences and reading time of some text.", { text: xs }, ["text"]),
  xfn("change_case", "Change text to UPPER, lower, Title or Sentence case (and copy it).", { text: xs, mode: { type: "string", enum: ["upper", "lower", "title", "sentence"] } }, ["text"]),
  xfn("text_tools", "Sort, de-duplicate, reverse or shuffle a list of lines (and copy it).", { text: xs, op: { type: "string", enum: ["sort", "dedupe", "reverse", "shuffle"] } }, ["text"]),
  xfn("days_between", "Count the days between two dates (or from a date to today).", { from: xs, to: xs }, ["from"]),
  xfn("list_add", "Add items to a named list (shopping, to-do, packing…).", { list: xs, items: xs }, ["items"]),
  xfn("list_show", "Show a named list, or all lists.", { list: xs }),
  xfn("list_clear", "Empty a named list.", { list: xs }, ["list"]),
  xfn("counter", "Keep a running tally of anything — add, subtract, show or reset.", { name: xs, action: { type: "string", enum: ["add", "subtract", "show", "reset"] }, by: { type: "integer" } }, ["name"]),
  xfn("world_clock", "The current time in a major city.", { city: xs }, ["city"]),
  xfn("timer", "Set a countdown timer that chimes while the app is open.", { minutes: xn, label: xs }, ["minutes"]),
  xfn("stopwatch", "Start, lap, check or stop a stopwatch.", { action: { type: "string", enum: ["start", "lap", "check", "stop"] } }),
  xfn("dua", "A short authentic dua, optionally for a topic (worry, ease, study, guidance…).", { topic: xs }),
  xfn("currency_convert", "Convert money between currencies at the live rate.", { amount: xn, from: xs, to: xs }, ["amount", "from", "to"]),
  xfn("crypto_price", "The live price of a cryptocurrency in USD and EGP.", { coin: xs }, ["coin"]),
  xfn("ip_info", "Your current public IP, city and internet provider.", {}),
  xfn("number_fact", "A piece of trivia about a number (or a random one).", { number: xn }),
  xfn("egypt_holidays", "Upcoming public holidays (Egypt by default).", { year: { type: "integer" }, country: xs }),
  xfn("sunrise_sunset", "Today's sunrise and sunset times for a place (Cairo by default).", { place: xs }),
  xfn("random_fact", "A surprising random fact.", {}),
  xfn("unit_price", "Compare options by price-per-unit to find the best value.", { options: xs }, ["options"]),
);
Object.assign(FEATURE_HANDLERS, {
  tip_calc: a => tipCalc(a), discount_calc: a => discountCalc(a), loan_calc: a => loanCalc(a), age_calc: a => ageCalc(a),
  zakat_calc: a => zakatCalc(a), calorie_calc: a => calorieCalc(a), pace_calc: a => paceCalc(a), fuel_cost: a => fuelCost(a),
  base_convert: a => baseConvert(a), roman_numerals: a => romanNumerals(a), word_count: a => wordCount(a), change_case: a => changeCase(a),
  text_tools: a => textTools(a), days_between: a => daysBetween(a), list_add: a => listAdd(a), list_show: a => listShow(a),
  list_clear: a => listClear(a), counter: a => counterTool(a), world_clock: a => worldClock(a), timer: a => timerTool(a),
  stopwatch: a => stopwatchTool(a), dua: a => duaTool(a), currency_convert: a => currencyConvert(a), crypto_price: a => cryptoPrice(a),
  ip_info: () => ipInfo(), number_fact: a => numberFact(a), egypt_holidays: a => egyptHolidays(a), sunrise_sunset: a => sunriseSunset(a),
  random_fact: () => randomFact(), unit_price: a => unitPriceCompare(a),
});
Object.assign(FEATURE_LABELS, {
  tip_calc: () => "TIP & SPLIT", discount_calc: () => "SALE PRICE", loan_calc: () => "LOAN MATHS", age_calc: () => "AGE",
  zakat_calc: () => "ZAKAT", calorie_calc: () => "CALORIES", pace_calc: () => "PACE", fuel_cost: () => "FUEL COST",
  base_convert: () => "BASE CONVERT", roman_numerals: () => "ROMAN NUMERALS", word_count: () => "WORD COUNT", change_case: a => `CASE → ${String(a.mode || "sentence").toUpperCase()}`,
  text_tools: a => `LINES: ${String(a.op || "sort").toUpperCase()}`, days_between: () => "DAYS BETWEEN", list_add: a => `ADDING TO ${String(a.list || "shopping").toUpperCase()}`, list_show: () => "LIST",
  list_clear: () => "CLEARING LIST", counter: a => `COUNTER: ${String(a.name || "").toUpperCase()}`, world_clock: a => `CLOCK: ${String(a.city || "").toUpperCase()}`, timer: a => "TIMER SET",
  stopwatch: a => `STOPWATCH ${String(a.action || "start").toUpperCase()}`, dua: () => "DUA", currency_convert: a => `${String(a.from || "").toUpperCase()}→${String(a.to || "").toUpperCase()}`, crypto_price: a => `CRYPTO: ${String(a.coin || "").toUpperCase()}`,
  ip_info: () => "CONNECTION", number_fact: () => "NUMBER FACT", egypt_holidays: () => "HOLIDAYS", sunrise_sunset: () => "SUN TIMES",
  random_fact: () => "RANDOM FACT", unit_price: () => "BEST VALUE",
});
TOOL_GROUPS.calc37 = {
  about: "everyday maths: tip & split, discounts, loans, age, zakat, calories, running pace, fuel cost, base/roman conversion, days between, best-value compare",
  tools: ["tip_calc", "discount_calc", "loan_calc", "age_calc", "zakat_calc", "calorie_calc", "pace_calc", "fuel_cost", "base_convert", "roman_numerals", "days_between", "unit_price"],
  match: /\b(tip|split the bill|discount|sale price|percent off|loan|instal?ment|mortgage|how old|my age|zakat|calorie|bmr|tdee|pace|how fast|fuel cost|petrol|gas cost|binary|hexadecimal|hex|roman numeral|days between|days until|best value|cheaper per|price per)\b|زكاة/i,
};
TOOL_GROUPS.text37 = {
  about: "text utilities: word & character count, change case, sort/dedupe/reverse/shuffle lines",
  tools: ["word_count", "change_case", "text_tools"],
  match: /\b(word count|how many words|character count|count the words|upper ?case|lower ?case|title case|sentence case|capitali[sz]e|sort (these|the|this|my) (lines|list)|de-?duplicate|dedupe|remove duplicates|shuffle (the|this|my) (lines|list)|reverse (the|this) (lines|list|order))\b/i,
};
TOOL_GROUPS.lists37 = {
  about: "named lists (shopping, to-do, packing) and running counters/tallies",
  tools: ["list_add", "list_show", "list_clear", "counter"],
  match: /\b(add .* to (my|the) .*list|shopping list|to-?do list|packing list|grocery list|show (my|the) list|clear (my|the) list|counter|tally|keep count|count how many)\b|قائمة/i,
};
TOOL_GROUPS.time37 = {
  about: "world clock, countdown timers, stopwatch",
  tools: ["world_clock", "timer", "stopwatch"],
  match: /\b(time in|what time is it in|world clock|timer|set a timer|countdown|stopwatch|lap time)\b/i,
};
TOOL_GROUPS.web37 = {
  about: "live lookups: currency conversion, crypto prices, IP/connection, number & random facts, public holidays, sunrise/sunset, dua",
  tools: ["currency_convert", "crypto_price", "ip_info", "number_fact", "egypt_holidays", "sunrise_sunset", "random_fact", "dua"],
  match: /\b(convert .* (to|into) (usd|egp|eur|dollars?|pounds?|euros?|riyals?|dirhams?)|exchange rate|how much is .* in (dollars?|pounds?|euros?)|bitcoin|crypto|ethereum|my ip|ip address|what('?s| is) my (ip|connection)|fact about|random fact|holiday|sunrise|sunset|dua|دعاء)\b/i,
};

async function initToolsmith() {
  state.counters = await store.get("counters", {});
  state.swatch = await store.get("swatch", null);
}
