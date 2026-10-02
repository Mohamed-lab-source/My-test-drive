/* ======================================================================
 * Jarvis 3.3 — the Lab pack
 *
 * Custom runnable protocols (a named chain of real actions), plus a set of
 * instant offline tools: unit converter, azkar & tasbeeh, decision maker,
 * password generator, and a date/age calculator. Loads after hub.js.
 * ====================================================================== */

Object.assign(state, { actionProtocols: [], tasbeeh: {} });

/* 1. Custom runnable protocols -------------------------------------------------- */
// A protocol is a name + an ordered list of steps. Each step is either a real
// tool call ({action, ...args}) or {action:"say", text}. Jarvis composes these
// from natural language ("make a workshop protocol that puts on Do Not Disturb,
// maxes brightness and plays focus music"), saves it, and runs it on command.
const STEP_ACTIONS = new Set([
  "do_not_disturb", "set_volume", "set_brightness", "set_ringer", "toggle_flashlight",
  "play_music", "media_control", "focus_mode", "set_silent_mode", "set_alarm", "set_timer",
  "open_app", "navigate", "open_settings_panel", "add_reminder", "say",
]);

function protoKey(name) { return String(name || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\bprotocol\b/g, "").trim(); }

function defineProtocol({ name, steps } = {}) {
  const key = protoKey(name);
  if (!key) throw new Error("Give the protocol a name.");
  if (!Array.isArray(steps) || !steps.length) throw new Error("A protocol needs at least one step.");
  const clean = [];
  for (const s of steps) {
    const action = s && s.action;
    if (!STEP_ACTIONS.has(action)) throw new Error(`"${action}" isn't an action I can put in a protocol.`);
    clean.push(s);
  }
  state.actionProtocols = state.actionProtocols.filter(p => p.key !== key);
  state.actionProtocols.push({ key, name: String(name).trim(), steps: clean, at: new Date().toISOString() });
  store.set("actionProtocols", state.actionProtocols);
  const label = String(name).trim().replace(/\s*protocol\s*$/i, "");
  return { saved: name, steps: clean.length, say: `${label} protocol ready, ${state.address}. Just say "run ${key}".` };
}

function describeStep(s) {
  if (s.action === "say") return `say "${String(s.text || "").slice(0, 40)}"`;
  if (typeof toolLabel === "function") { try { return String(toolLabel(s.action, s)).replace(/^›\s*/, "").toLowerCase(); } catch {} }
  return s.action.replace(/_/g, " ");
}

async function runProtocol({ name } = {}) {
  const key = protoKey(name);
  // Built-in goodnight / good-morning still handled by their routine.
  if (/night|bed|sleep|morning|wake/.test(key) && typeof runRoutine === "function" && !state.actionProtocols.some(p => p.key === key)) {
    return runRoutine({ name: /night|bed|sleep/.test(key) ? "goodnight" : "good_morning" });
  }
  const p = state.actionProtocols.find(x => x.key === key)
    || state.actionProtocols.find(x => x.key.includes(key) || key.includes(x.key));
  if (!p) throw new Error(`No protocol called "${name}". Saved: ${state.actionProtocols.map(x => x.key).join(", ") || "none"}.`);
  const done = [], failed = [];
  for (const s of p.steps) {
    try {
      if (s.action === "say") { addMsg("assistant", s.text); if (!state.silentMode) await speakWithHud(s.text); }
      else await executeTool(s.action, s);
      done.push(describeStep(s));
    } catch (e) { failed.push(`${describeStep(s)} (${e.message})`); }
  }
  if (typeof logActivity === "function") logActivity(`PROTOCOL: ${p.name.toUpperCase()}`);
  return { ran: p.name, done, couldNot: failed.length ? failed : undefined };
}

function listProtocols() {
  return { protocols: state.actionProtocols.map(p => ({ name: p.name, run: `run ${p.key}`, steps: p.steps.map(describeStep) })) };
}

function deleteActionProtocol({ name } = {}) {
  const key = protoKey(name);
  const before = state.actionProtocols.length;
  state.actionProtocols = state.actionProtocols.filter(p => !(p.key === key || p.key.includes(key)));
  if (state.actionProtocols.length === before) throw new Error(`No protocol called "${name}".`);
  store.set("actionProtocols", state.actionProtocols);
  return { removed: name };
}

/* 2. Unit converter (offline) --------------------------------------------------- */
const UNITS = {
  length: { m: 1, meter: 1, meters: 1, km: 1000, kilometer: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254, yd: 0.9144, yard: 0.9144 },
  mass: { kg: 1, kilo: 1, kilos: 1, kilogram: 1, g: 0.001, gram: 0.001, grams: 0.001, mg: 1e-6, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237, oz: 0.0283495, ounce: 0.0283495, ton: 1000, tonne: 1000 },
  volume: { l: 1, liter: 1, litre: 1, liters: 1, ml: 0.001, gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784, cup: 0.236588, cups: 0.236588, tbsp: 0.0147868, tsp: 0.00492892 },
  speed: { "km/h": 1, kmh: 1, kph: 1, "m/s": 3.6, ms: 3.6, mph: 1.609344, knot: 1.852, knots: 1.852 },
  area: { "m2": 1, sqm: 1, "km2": 1e6, ha: 1e4, hectare: 1e4, acre: 4046.86, "ft2": 0.092903, sqft: 0.092903, feddan: 4200.83 },
};
const normUnit = u => String(u || "").toLowerCase().trim().replace(/s$/, s => s).replace(/²/, "2").replace(/\s/g, "");
function convertUnits({ value, from, to } = {}) {
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error("A number to convert, please.");
  const f = normUnit(from), t = normUnit(to);
  // Temperature is affine, handled on its own.
  const temp = { c: 1, celsius: 1, f: 1, fahrenheit: 1, k: 1, kelvin: 1 };
  if (temp[f] && temp[t]) {
    let c = f[0] === "c" ? v : f[0] === "f" ? (v - 32) * 5 / 9 : v - 273.15;
    let out = t[0] === "c" ? c : t[0] === "f" ? c * 9 / 5 + 32 : c + 273.15;
    return { value: v, from, to, result: Math.round(out * 100) / 100 };
  }
  for (const [cat, map] of Object.entries(UNITS)) {
    if (map[f] !== undefined && map[t] !== undefined) {
      const result = v * map[f] / map[t];
      return { value: v, from, to, category: cat, result: Math.round(result * 1e6) / 1e6 };
    }
  }
  throw new Error(`I can't convert ${from} to ${to} — different kinds of unit, or one I don't know.`);
}

/* 3. Azkar & tasbeeh ------------------------------------------------------------ */
const AZKAR = {
  morning: [
    { ar: "أَصْبَحْنا وأَصْبَحَ المُلْكُ لله", en: "We have reached the morning and so has all dominion, which belongs to Allah." },
    { ar: "اللّهُمَّ بِكَ أَصْبَحْنا وبِكَ أَمْسَيْنا", en: "O Allah, by You we enter the morning and the evening." },
    { ar: "رَضِيتُ بِاللهِ رَبّاً، وبِالإسْلامِ ديناً، وبِمُحَمّدٍ ﷺ نَبِيّاً", en: "I am pleased with Allah as Lord, Islam as religion, and Muhammad ﷺ as Prophet." },
    { ar: "حَسْبِيَ اللهُ لا إلهَ إلا هو، عليهِ تَوَكَّلْتُ", en: "Allah is sufficient for me; there is no god but Him, upon Him I rely." },
  ],
  evening: [
    { ar: "أَمْسَيْنا وأَمْسى المُلْكُ لله", en: "We have reached the evening and so has all dominion, which belongs to Allah." },
    { ar: "اللّهُمَّ ما أَمْسى بي مِن نِعْمَةٍ فَمِنْكَ وَحْدَكَ", en: "O Allah, whatever blessing I have this evening is from You alone." },
    { ar: "أَعوذُ بِكَلِماتِ اللهِ التّاماتِ مِن شَرِّ ما خَلَق", en: "I seek refuge in Allah's perfect words from the evil of what He created." },
  ],
};
function azkar({ time } = {}) {
  const t = /even|night|مسا/i.test(time || "") ? "evening" : /morn|صبا/i.test(time || "") ? "morning" : (new Date().getHours() < 15 ? "morning" : "evening");
  return { time: t, azkar: AZKAR[t], note: "Read each a few times, unhurried. These are a short selection." };
}
function tasbeeh({ phrase, reset, to } = {}) {
  const key = String(phrase || "subhanallah").toLowerCase().trim();
  if (reset) { state.tasbeeh[key] = 0; } else { state.tasbeeh[key] = (state.tasbeeh[key] || 0) + 1; }
  store.set("tasbeeh", state.tasbeeh);
  const target = to || 33;
  const count = state.tasbeeh[key];
  buzz && buzz(count % target === 0 && count > 0 ? "success" : "light");
  return { phrase: key, count, reached: count > 0 && count % target === 0 ? target : undefined };
}

/* 4. Decision maker ------------------------------------------------------------- */
function decide({ mode, options, sides, min, max } = {}) {
  const m = String(mode || (options && options.length ? "pick" : "coin")).toLowerCase();
  if (m === "coin" || /flip/.test(m)) return { result: Math.random() < 0.5 ? "Heads" : "Tails" };
  if (m === "dice" || /roll/.test(m)) { const s = clampNum(sides, 2, 1000, 6); return { result: 1 + Math.floor(Math.random() * s), sides: s }; }
  if (m === "number") { const lo = Number(min) || 1, hi = Number(max) || 100; return { result: lo + Math.floor(Math.random() * (hi - lo + 1)), range: `${lo}–${hi}` }; }
  const list = (Array.isArray(options) ? options : String(options || "").split(/\s*,\s*|\s+or\s+/)).map(s => String(s).trim()).filter(Boolean);
  if (!list.length) throw new Error("Give me the options to choose between.");
  return { chose: list[Math.floor(Math.random() * list.length)], from: list };
}

/* 5. Password generator (offline) ---------------------------------------------- */
const PW_WORDS = "arc,reactor,stark,jarvis,cairo,falcon,nebula,quantum,titan,vortex,cobalt,ember,onyx,raven,zephyr,delta,sierra,orbit,photon,cipher,matrix,vector,pulse,forge,atlas,comet,nova,flux,halo,prism".split(",");
function generatePassword({ length, words, symbols } = {}) {
  const rnd = n => { const a = new Uint32Array(n); (crypto.getRandomValues ? crypto : window.crypto).getRandomValues(a); return a; };
  if (words) {
    const n = clampNum(words, 2, 8, 4);
    const r = rnd(n + 1);
    const parts = Array.from({ length: n }, (_, i) => { const w = PW_WORDS[r[i] % PW_WORDS.length]; return w[0].toUpperCase() + w.slice(1); });
    const pass = parts.join("-") + "-" + (r[n] % 100);
    return { password: pass, kind: "passphrase (easy to remember)" };
  }
  const len = clampNum(length, 8, 64, 16);
  let chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (symbols !== false) chars += "!@#$%^&*?-_=+";
  const r = rnd(len);
  const pass = Array.from({ length: len }, (_, i) => chars[r[i] % chars.length]).join("");
  return { password: pass, length: len, note: "Generated on your phone; not stored. Copy it now." };
}

/* 6. Date & age calculator ------------------------------------------------------ */
function parseDateLoose(s) {
  if (!s) return null;
  const str = String(s).trim();
  let d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? str + "T12:00:00" : str);
  return isNaN(d) ? null : d;
}
function dateCalc({ date, from, mode } = {}) {
  const target = parseDateLoose(date);
  if (!target) throw new Error("Give me a date, like 2026-12-20.");
  const base = parseDateLoose(from) || new Date();
  const startT = startOfDay(target).getTime(), startB = startOfDay(base).getTime();
  const days = Math.round((startT - startB) / 86400000);
  const out = {
    date: target.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    weekday: target.toLocaleDateString("en-GB", { weekday: "long" }),
  };
  if (/age|old/.test(mode || "") || (target < new Date() && /^\d{4}/.test(String(date)))) {
    let age = base.getFullYear() - target.getFullYear();
    const m = base.getMonth() - target.getMonth();
    if (m < 0 || (m === 0 && base.getDate() < target.getDate())) age--;
    out.age = age;
  }
  out.daysAway = Math.abs(days);
  out.direction = days === 0 ? "today" : days > 0 ? `in ${days} days` : `${-days} days ago`;
  if (days > 0) out.weeks = Math.round(days / 7 * 10) / 10;
  return out;
}

/* Tools ------------------------------------------------------------------------- */
FEATURE_TOOLS.push(
  xfn("define_protocol", "Create (or replace) a named protocol: a chain of actions Jarvis runs on command. Build the steps from what the user describes. Each step is {action, ...args}; allowed actions: do_not_disturb{on}, set_volume{percent}, set_brightness{percent|auto}, set_ringer{mode}, toggle_flashlight{on}, play_music{query}, media_control{action}, focus_mode{minutes}, set_silent_mode{on}, set_alarm{hour,minute}, set_timer{seconds}, open_app{name}, navigate{destination}, open_settings_panel{panel}, add_reminder{text,when}, say{text}.",
    { name: xs, steps: { type: "array", items: { type: "object" }, description: "Ordered steps, each an object with an 'action' and its arguments" } }, ["name", "steps"]),
  xfn("run_protocol", "Run a saved protocol by name (also runs the built-in goodnight / good morning).", { name: xs }, ["name"]),
  xfn("list_protocols", "List the user's saved runnable protocols and their steps."),
  xfn("delete_protocol_actions", "Delete a saved runnable protocol.", { name: xs }, ["name"]),
  xfn("convert_units", "Convert between units: length, mass, volume, speed, area, temperature.", { value: xn, from: xs, to: xs }, ["value", "from", "to"]),
  xfn("azkar", "Islamic morning or evening remembrances (azkar).", { time: { type: "string", enum: ["morning", "evening"] } }),
  xfn("tasbeeh", "A tasbeeh (dhikr) counter: counts one by one, or resets.", { phrase: xs, reset: { type: "boolean" }, to: { type: "integer" } }),
  xfn("decide", "Make a quick choice: flip a coin, roll a die, pick from options, or a random number.", { mode: { type: "string", enum: ["coin", "dice", "pick", "number"] }, options: { type: "array", items: xs }, sides: { type: "integer" }, min: xn, max: xn }),
  xfn("generate_password", "Generate a strong password (or a memorable passphrase with words:true), on the phone.", { length: { type: "integer" }, words: { type: "integer" }, symbols: { type: "boolean" } }),
  xfn("date_calc", "Days until/since a date, the weekday of a date, or age from a birthdate.", { date: xs, from: xs, mode: { type: "string", enum: ["until", "age", "weekday"] } }, ["date"]),
);
Object.assign(FEATURE_HANDLERS, {
  define_protocol: a => defineProtocol(a), run_protocol: a => runProtocol(a), list_protocols: () => listProtocols(), delete_protocol_actions: a => deleteActionProtocol(a),
  convert_units: a => convertUnits(a), azkar: a => azkar(a), tasbeeh: a => tasbeeh(a), decide: a => decide(a),
  generate_password: a => generatePassword(a), date_calc: a => dateCalc(a),
});
Object.assign(FEATURE_LABELS, {
  define_protocol: a => `PROTOCOL DEFINED: ${String(a.name || "").toUpperCase()}`,
  run_protocol: a => `ENGAGING ${String(a.name || "").toUpperCase()} PROTOCOL`,
  list_protocols: () => "LISTING PROTOCOLS", delete_protocol_actions: a => `PROTOCOL REMOVED: ${a.name || ""}`,
  convert_units: a => `CONVERTING ${a.value || ""} ${a.from || ""} → ${a.to || ""}`,
  azkar: a => `AZKAR · ${String(a.time || "").toUpperCase() || "NOW"}`, tasbeeh: a => a.reset ? "TASBEEH RESET" : "TASBEEH",
  decide: () => "DECIDING", generate_password: () => "GENERATING PASSWORD", date_calc: () => "CALCULATING DATES",
});
Object.assign(TOOL_GROUPS, {
  lab: {
    about: "custom runnable protocols (define and run action chains), decisions (coin/dice/pick), password generation",
    tools: ["define_protocol", "run_protocol", "list_protocols", "delete_protocol_actions", "decide", "generate_password"],
    match: /\b(protocol|routine|run the|engage|activate|sequence|automation|flip a coin|coin|roll|dice|pick (one|between|for me)|choose for me|decide|random (number|choice)|password|passphrase)\b|بروتوكول|شغّل/i,
  },
  convert: {
    about: "unit conversion and date/age calculations",
    tools: ["convert_units", "date_calc"],
    match: /\b(convert|how many|in (miles|km|kg|pounds|celsius|fahrenheit|liters|gallons)|metres?|meters?|kilo|pounds?|ounces?|miles?|celsius|fahrenheit|how (many days|long) (until|till|since|ago)|what day|how old|age|days until|weekday)\b/i,
  },
});
TOOL_GROUPS.deen.tools.push("azkar", "tasbeeh");
TOOL_GROUPS.deen.match = new RegExp(TOOL_GROUPS.deen.match.source + "|\\b(azkar|adhkar|dhikr|zikr|tasbeeh|tasbih|subhanallah|alhamdulillah|remembrance)\\b|أذكار|اذكار|تسبيح|ذكر", "i");

/* Planner card ------------------------------------------------------------------ */
function renderProtocols() {
  const box = document.getElementById("protocolsList");
  if (!box || !state.actionProtocols.length) return;
  // Append runnable protocols under the existing protocols card as tappable chips.
  let wrap = document.getElementById("runnableProtocols");
  if (!wrap) { wrap = el("div", "run-protocols"); wrap.id = "runnableProtocols"; box.parentNode.appendChild(wrap); }
  wrap.innerHTML = "";
  state.actionProtocols.forEach(p => {
    const b = el("button", "chip", `▶ ${p.name}`);
    b.title = p.steps.map(describeStep).join(" → ");
    b.addEventListener("click", async () => { if (busy || conversationActive) return; buzz("medium"); const r = await runProtocol({ name: p.key }).catch(e => ({ ran: null, err: e.message })); toast(r.ran ? `${r.ran} engaged` : r.err, 3000); });
    wrap.appendChild(b);
  });
}

async function initLab() {
  state.actionProtocols = await store.get("actionProtocols", []);
  state.tasbeeh = await store.get("tasbeeh", {});
  renderProtocols();
  const tab = document.querySelector('.tab[data-view="remindersView"]');
  if (tab) tab.addEventListener("click", renderProtocols);
}
