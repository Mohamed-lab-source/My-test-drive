/* ======================================================================
 * Jarvis 2.3 — presence & personality
 *
 * Loads after app.js and features.js. Where it changes existing behaviour
 * it wraps app.js functions (top-level function declarations are global
 * bindings, so reassigning them here changes every caller) rather than
 * editing them in place.
 * ====================================================================== */

const { Haptics } = (window.Capacitor && window.Capacitor.Plugins) || {};

const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = iso => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const prefersReducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 1. Haptics ------------------------------------------------------------- */
function buzz(kind = "light") {
  if (!state.haptics || !Haptics) return;
  Promise.resolve().then(() => {
    if (kind === "success") return Haptics.notification({ type: "SUCCESS" });
    if (kind === "warn") return Haptics.notification({ type: "WARNING" });
    if (kind === "long") return Haptics.vibrate({ duration: 220 });
    return Haptics.impact({ style: kind === "medium" ? "MEDIUM" : "LIGHT" });
  }).catch(() => {});
}

const baseEarcon = earcon;
earcon = function (kind) {
  buzz(kind === "listen" ? "medium" : "light");
  return baseEarcon(kind);
};

/* 2. HUD themes ---------------------------------------------------------- */
const HUD_THEMES = { arc: "Arc Reactor", mark3: "Mark III — red & gold", stealth: "Stealth", vibranium: "Vibranium" };
function applyHudTheme() {
  document.documentElement.dataset.hud = HUD_THEMES[state.hudTheme] ? state.hudTheme : "arc";
}

/* 3. Typewriter reveal --------------------------------------------------- */
let typingJob = null;
function finishTyping() { if (typingJob) typingJob.finish(); }

function typeOut(el, text, spoken) {
  finishTyping();
  if (prefersReducedMotion() || text.length < 4) { el.textContent = text; return; }
  const cps = spoken ? 16 : 90; // roughly speaking pace when voiced; quick when read
  const log = document.getElementById("chatLog");
  const started = performance.now();
  let shown = 0;
  el.textContent = "";
  el.classList.add("typing");
  const job = {
    finish() {
      clearInterval(timer);
      el.textContent = text;
      el.classList.remove("typing");
      if (typingJob === job) typingJob = null;
      if (log) log.scrollTop = log.scrollHeight;
    },
  };
  typingJob = job;
  const timer = setInterval(() => {
    const n = Math.min(text.length, Math.floor((performance.now() - started) / 1000 * cps) + 1);
    if (n > shown) {
      shown = n;
      el.textContent = text.slice(0, shown);
      if (log) log.scrollTop = log.scrollHeight;
    }
    if (shown >= text.length) job.finish();
  }, 40);
}

/* 4. Voice: faster premium speech, voice-reactive core, silent mode, Arabic */
const ARABIC_SCRIPT = /[؀-ۿ]/;
const clipMemo = new Map();
let clipStore = null; // short phrases, persisted: summons and sign-offs play instantly
let premiumCancelled = false;

async function loadClipStore() {
  if (!clipStore) clipStore = await store.get("voiceClips", {});
  return clipStore;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchElevenLabsBlob(text) {
  const short = text.length <= 40;
  const key = `${state.elevenLabsVoiceId}|${text}`;
  if (short) {
    if (clipMemo.has(key)) return clipMemo.get(key);
    const saved = (await loadClipStore())[key];
    if (saved) {
      try {
        const blob = await (await fetch(saved.data)).blob();
        clipMemo.set(key, blob);
        return blob;
      } catch {}
    }
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${state.elevenLabsVoiceId}`, {
    method: "POST",
    headers: { "xi-api-key": state.elevenLabsApiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5", // fast, cheap on the free quota, and multilingual (Arabic included)
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}${body ? ": " + body.slice(0, 140) : ""}`);
  }
  const blob = await res.blob();
  if (short) {
    clipMemo.set(key, blob);
    try {
      const clips = await loadClipStore();
      clips[key] = { data: await blobToDataUrl(blob), at: Date.now() };
      const keys = Object.keys(clips).sort((a, b) => clips[b].at - clips[a].at);
      keys.slice(16).forEach(k => delete clips[k]);
      store.set("voiceClips", clips);
    } catch {}
  }
  return blob;
}

// First sentence on its own so he starts talking sooner; the rest in
// ~240-character chunks, each fetched while the previous one plays.
function speechChunks(text) {
  const sentences = text.match(/[^.!?؟]+[.!?؟]+["')\]]*\s*|[^.!?؟]+$/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if (!chunks.length && !cur) { chunks.push(s.trim()); continue; }
    if (cur && (cur + s).length > 240) { chunks.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

let voiceAnalyser = null;
let meterRaf = 0;

async function ensureAnalyser() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== "running") {
      await Promise.race([audioCtx.resume(), sleep(300)]);
    }
    // Routing through a suspended context would silence the voice; skip the meter instead.
    if (audioCtx.state !== "running") return null;
    if (!voiceAnalyser) {
      voiceAnalyser = audioCtx.createAnalyser();
      voiceAnalyser.fftSize = 256;
      voiceAnalyser.connect(audioCtx.destination);
    }
    return voiceAnalyser;
  } catch { return null; }
}

function startMeter() {
  const reactor = document.getElementById("reactor");
  if (!reactor || !voiceAnalyser || prefersReducedMotion()) return;
  const buf = new Uint8Array(voiceAnalyser.fftSize);
  reactor.classList.add("reactive");
  cancelAnimationFrame(meterRaf);
  const tick = () => {
    voiceAnalyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
    reactor.style.setProperty("--level", level.toFixed(3));
    meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

function stopMeter() {
  cancelAnimationFrame(meterRaf);
  const reactor = document.getElementById("reactor");
  if (!reactor) return;
  reactor.classList.remove("reactive");
  reactor.style.setProperty("--level", "0");
}

async function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let source = null;
  const analyser = await ensureAnalyser();
  if (analyser) {
    try { source = audioCtx.createMediaElementSource(audio); source.connect(analyser); startMeter(); }
    catch { source = null; }
  }
  try {
    await new Promise((resolve, reject) => {
      currentPremiumAudio = { audio, resolve };
      audio.onended = resolve;
      audio.onerror = () => reject(new Error("playback failed"));
      audio.play().catch(reject);
    });
  } finally {
    currentPremiumAudio = null;
    stopMeter();
    if (source) { try { source.disconnect(); } catch {} }
    URL.revokeObjectURL(url);
  }
}

speakElevenLabs = async function (text) {
  premiumCancelled = false;
  const chunks = speechChunks(text);
  let next = fetchElevenLabsBlob(chunks[0]);
  for (let i = 0; i < chunks.length; i++) {
    let blob;
    try { blob = await next; }
    catch (e) { e.remaining = chunks.slice(i).join(" "); throw e; }
    if (premiumCancelled) return;
    next = i + 1 < chunks.length ? fetchElevenLabsBlob(chunks[i + 1]) : null;
    if (next) next.catch(() => {}); // surfaced when awaited above
    try { await playBlob(blob); }
    catch (e) { e.remaining = chunks.slice(i).join(" "); throw e; }
    if (premiumCancelled) return;
  }
};

const baseStopPremiumAudio = stopPremiumAudio;
stopPremiumAudio = function () {
  premiumCancelled = true;
  baseStopPremiumAudio();
};

speak = async function (text) {
  if (!text) return;
  if (state.silentMode) { buzz("medium"); finishTyping(); return; }
  if (state.useElevenLabs && state.elevenLabsApiKey && state.elevenLabsVoiceId) {
    try {
      await speakElevenLabs(text);
      finishTyping();
      return;
    } catch (e) {
      if (premiumCancelled) return;
      console.warn("ElevenLabs TTS failed, falling back to device voice", e);
      toast("Premium voice unavailable — using phone voice");
      text = e.remaining || text; // carry on from where the premium voice stopped
    }
  }
  try {
    if (ARABIC_SCRIPT.test(text)) {
      await TextToSpeech.speak({ text, lang: "ar-EG", rate: state.rate, pitch: state.pitch, volume: 1.0, category: "ambient" });
    } else {
      await speakDevice(text);
    }
  } catch (e) { console.warn("TTS failed", e); }
  finishTyping();
};

/* 5. Summoned, or opened from a home-screen shortcut --------------------- */
function acknowledgements() {
  const a = state.address;
  return [`Yes, ${a}?`, `At your service, ${a}.`, `${capFirst(a)}?`, `Listening, ${a}.`];
}

async function acknowledge() {
  if (state.silentMode) { buzz("medium"); return; }
  await speakWithHud(pick(acknowledgements()));
}

function openTab(viewId) {
  const tab = document.querySelector(`.tab[data-view="${viewId}"]`);
  if (tab) tab.click();
}

handleAssist = async function () {
  let action = null;
  try {
    const r = await DeviceActions.consumeAssistLaunch();
    action = r.action || (r.assist ? "talk" : null);
  } catch {}
  if (!action) return false;
  document.getElementById("settingsView").style.display = "none";
  if (action === "planner") { openTab("remindersView"); return true; }
  if (action === "briefing") {
    openTab("briefingView");
    state.lastGreetAt = Date.now();
    store.set("lastGreetAt", state.lastGreetAt);
    if (!busy) runBriefing();
    return true;
  }
  openTab("chatView");
  if (speakingNow) await stopSpeaking();
  if (!conversationActive && !busy) {
    await acknowledge();
    conversation();
  }
  return true;
};

/* 6. Boot sequence — first open of the day ------------------------------- */
async function bootSequence() {
  const today = new Date().toDateString();
  if (state.lastBootDate === today) return;
  state.lastBootDate = today;
  store.set("lastBootDate", today);
  const overlay = document.getElementById("bootOverlay");
  const log = overlay && overlay.querySelector(".boot-log");
  if (!overlay || !log) return;

  await refreshAbilityStatus();
  const premium = state.useElevenLabs && state.elevenLabsApiKey && state.elevenLabsVoiceId;
  const rows = [
    ["CORE", "ONLINE", true],
    ["NEURAL LINK · GROQ", state.apiKey ? "ESTABLISHED" : "NO KEY", !!state.apiKey],
    ["VOICE SYNTHESIS", premium ? "ELEVENLABS" : "DEVICE", true],
    ["GOOGLE UPLINK", state.calendarRefreshToken ? "CONNECTED" : "OFFLINE", !!state.calendarRefreshToken],
    ["MESSAGE WATCH", abilities.notifications ? "ACTIVE" : "OFF", abilities.notifications],
    ["MEMORY BANKS", `${state.memories.length} ENTRIES`, true],
    ["POWER", telemetry.battery >= 0 ? `${telemetry.battery}%` : "--", telemetry.battery < 0 || telemetry.battery > 15 || telemetry.charging],
  ];
  const step = prefersReducedMotion() ? 40 : 190;
  let skipped = false;
  overlay.hidden = false;
  overlay.classList.remove("fade");
  log.innerHTML = "";
  overlay.onclick = () => { skipped = true; };
  for (const [label, value, ok] of rows) {
    if (skipped) break;
    const row = document.createElement("div");
    row.className = "boot-row";
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("span");
    v.textContent = value;
    v.className = ok ? "ok" : "off";
    row.append(l, v);
    log.appendChild(row);
    buzz("light");
    await sleep(step);
  }
  if (!skipped) {
    const done = document.createElement("div");
    done.className = "boot-done";
    done.textContent = "ALL SYSTEMS ONLINE";
    log.appendChild(done);
    earcon("end");
    await sleep(prefersReducedMotion() ? 200 : 750);
  }
  overlay.classList.add("fade");
  await sleep(350);
  overlay.hidden = true;
}

/* 7. HUD widgets: weather, next event, messages -------------------------- */
async function refreshWidgets() {
  const el = document.getElementById("hudWidgets");
  if (!el) return;
  const parts = [];
  const jobs = [];
  // Only a saved home location — never trigger a GPS prompt from the HUD.
  if (state.homeLoc) {
    jobs.push(getWeather().then(w => { parts[0] = `${w.tempC}° ${w.description.toUpperCase()}`; }));
  }
  if (state.calendarRefreshToken) {
    jobs.push(listTodayEvents().then(evs => {
      const next = evs.find(e => e.start && e.start.includes("T") && new Date(e.start) > new Date());
      parts[1] = next ? `NEXT ${hhmm(next.start)} ${next.title.toUpperCase().slice(0, 18)}` : "DAY CLEAR";
    }));
  }
  if (abilities.notifications) {
    jobs.push(DeviceActions.getRecentNotifications({ sinceMinutes: 180 }).then(({ messages }) => {
      const n = (messages || []).length;
      parts[2] = `${n} MSG${n === 1 ? "" : "S"}`;
    }));
  }
  await Promise.allSettled(jobs);
  const text = parts.filter(Boolean).join("  //  ");
  el.textContent = text;
  el.hidden = !text;
}

/* 8. Suggestion chips by time of day ------------------------------------- */
function chipSet() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return [["Brief me", "briefing"], ["Weather today"], ["What's on today?"]];
  if (h >= 12 && h < 17) return [["What did I miss?"], ["Latest news"], ["Coffee nearby"]];
  if (h >= 17 && h < 23) return [["What's on tomorrow?"], ["Any messages?"], ["Tomorrow's weather"]];
  return [["Set an alarm for 7 AM"], ["Do not disturb on"], ["Tomorrow's first event"]];
}

let renderedChips = "";
function renderChips() {
  const box = document.getElementById("chips");
  if (!box) return;
  const set = chipSet();
  const sig = set.map(c => c[0]).join("|");
  if (sig === renderedChips) return;
  renderedChips = sig;
  box.innerHTML = "";
  for (const [label, action] of set) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", async () => {
      if (busy || conversationActive) return;
      buzz("light");
      if (action === "briefing") {
        openTab("briefingView");
        runBriefing();
        return;
      }
      const reply = await ask(label);
      if (reply) await speakWithHud(reply);
    });
    box.appendChild(b);
  }
}

/* 9–11. Prompt additions: wit, language, silent mode, episodic memory ---- */
function presencePromptLines() {
  const out = [];
  if (state.wit === "reserved") out.push("Wit setting: RESERVED. Crisp and efficient; humour only very rarely.");
  if (state.wit === "stark") out.push("Wit setting: FULL STARK. More sardonic banter and dry one-liners (still one per reply, still after the job).");
  if (state.listenLang === "ar-EG") out.push("The user usually speaks Egyptian Arabic: answer in Egyptian Arabic unless they use English.");
  if (state.silentMode) out.push("Silent mode is on: your replies are read, not heard.");
  out.push(`Emergency contact: ${state.emergencyNumber ? (state.emergencyName || "set") : "not set (Settings)"}.`);
  if (state.convoSummary) out.push(`Earlier conversations (your notes): ${state.convoSummary}`);
  return out;
}

/* 12. Episodic memory — older turns folded into a rolling summary -------- */
let summarizing = false;

function queueForSummary(messages, kept) {
  const nonSystem = messages.filter(m => m.role !== "system");
  const dropped = nonSystem.slice(0, Math.max(0, nonSystem.length - kept.length));
  const lines = dropped
    .filter(m => (m.role === "user" || m.role === "assistant") && m.content && !String(m.content).startsWith("["))
    .map(m => `${m.role === "user" ? "User" : "Jarvis"}: ${String(m.content).slice(0, 300)}`);
  if (!lines.length) return;
  state.summaryBuffer = [...state.summaryBuffer, ...lines].slice(-40);
  store.set("summaryBuffer", state.summaryBuffer);
  if (state.summaryBuffer.length >= 8) summarizeConversation();
}

async function summarizeConversation() {
  if (summarizing || !state.apiKey) return;
  summarizing = true;
  const batch = state.summaryBuffer.slice();
  try {
    // The smaller model has its own free budget, so this doesn't eat into the main one.
    const data = await callGroq([
      { role: "system", content: "You keep a running memory of a user's conversations with their assistant, Jarvis. Merge the earlier notes with the new exchanges into at most 120 words of plain notes: topics, decisions, requests, open threads, people. No preamble, no markdown." },
      { role: "user", content: `Earlier notes:\n${state.convoSummary || "(none)"}\n\nNew exchanges:\n${batch.join("\n")}` },
    ], { withTools: false, model: "openai/gpt-oss-20b" });
    const text = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
    if (text) {
      state.convoSummary = text.slice(0, 1200);
      state.summaryBuffer = state.summaryBuffer.slice(batch.length);
      store.set("convoSummary", state.convoSummary);
      store.set("summaryBuffer", state.summaryBuffer);
    }
  } catch (e) {
    console.warn("summary failed", e);
  } finally {
    summarizing = false;
  }
}

/* 13. Activity log -------------------------------------------------------- */
const READ_ONLY_TOOL = /^(get_|list_|read_|find_|search_|lookup_|web_search|where_am_i|calculate|convert_|world_time|run_diagnostics|enable_tools)/;

function logActivity(label) {
  state.activityLog.unshift({ at: new Date().toISOString(), label });
  state.activityLog = state.activityLog.slice(0, 100);
  store.set("activityLog", state.activityLog);
  renderActivity();
}

function renderActivity() {
  const box = document.getElementById("activityList");
  if (!box) return;
  box.innerHTML = "";
  if (!state.activityLog.length) {
    box.innerHTML = '<div class="empty-hint">Nothing yet. Every call, text, reminder and switch Jarvis flips is logged here.</div>';
    return;
  }
  state.activityLog.slice(0, 30).forEach(a => {
    const row = document.createElement("div");
    row.className = "activity-item";
    const t = document.createElement("span");
    t.className = "activity-time";
    t.textContent = fmtWhen(a.at);
    const l = document.createElement("span");
    l.textContent = a.label;
    row.append(t, l);
    box.appendChild(row);
  });
}

const baseExecuteTool = executeTool;
executeTool = async function (name, args) {
  const result = await baseExecuteTool(name, args);
  if (!READ_ONLY_TOOL.test(name) && !(result && result.error)) {
    logActivity(String(toolLabel(name, args)).replace(/^›\s*/, ""));
    buzz("success");
  }
  return result;
};

/* 14. Meeting heads-up, ten minutes before ------------------------------- */
const MEETING_ID_BASE = 200000;

async function scheduleMeetingAlerts(events) {
  if (state.meetingAlertIds.length) {
    try { await LocalNotifications.cancel({ notifications: state.meetingAlertIds.map(id => ({ id })) }); } catch {}
    state.meetingAlertIds = [];
  }
  if (state.meetingAlerts) {
    const now = Date.now();
    const upcoming = events
      .filter(e => e.start && e.start.includes("T"))
      .map(e => ({ ...e, at: new Date(e.start).getTime() - 10 * 60000 }))
      .filter(e => e.at > now + 30000)
      .slice(0, 10);
    if (upcoming.length && await ensureNotifyPermission()) {
      const notifications = upcoming.map((e, i) => ({
        id: MEETING_ID_BASE + i,
        title: "Jarvis",
        body: `${e.title} begins in ten minutes, ${state.address}.`,
        schedule: { at: new Date(e.at), allowWhileIdle: true },
      }));
      await LocalNotifications.schedule({ notifications });
      state.meetingAlertIds = notifications.map(n => n.id);
    }
  }
  store.set("meetingAlertIds", state.meetingAlertIds);
}

const baseListTodayEvents = listTodayEvents;
listTodayEvents = async function () {
  const events = await baseListTodayEvents();
  scheduleMeetingAlerts(events).catch(e => console.warn("meeting alerts", e));
  return events;
};

/* 15–16. Telemetry: low-battery warnings, silent-mode tag ---------------- */
let lastBatteryReading = null;
const baseRefreshTelemetry = refreshTelemetry;
refreshTelemetry = async function () {
  await baseRefreshTelemetry();
  document.querySelectorAll(".tel-mode").forEach(el => { el.hidden = !state.silentMode; });
  renderChips();
  const level = telemetry.battery;
  if (level < 0) return;
  const prev = lastBatteryReading;
  lastBatteryReading = level;
  // Warn on the way down only, never on the first reading (the greeting covers that).
  if (prev === null || telemetry.charging) return;
  const crossed = [20, 10, 5].find(t => prev > t && level <= t);
  if (!crossed) return;
  const a = state.address;
  const line = crossed === 20 ? `Power's down to twenty percent, ${a}. I'd find a charger.`
    : crossed === 10 ? `Ten percent, ${a}. We're running on fumes.`
    : `Five percent, ${a}. I shan't be with you much longer without a charger.`;
  buzz("warn");
  addMsg("assistant", line);
  if (!busy && !conversationActive && !speakingNow) speakWithHud(line);
};

function setSilentMode(on) {
  state.silentMode = !!on;
  store.set("silentMode", state.silentMode);
  const t = document.getElementById("silentToggle");
  if (t) t.checked = state.silentMode;
  document.querySelectorAll(".tel-mode").forEach(el => { el.hidden = !state.silentMode; });
  if (state.silentMode) stopSpeaking();
  return { silentMode: state.silentMode };
}

/* 17. Emergency protocol ------------------------------------------------- */
async function emergencyProtocol({ situation } = {}) {
  if (!state.emergencyNumber) {
    throw new Error("No emergency contact is set (Settings → Emergency protocol). If life is at risk call 123 (ambulance) or 122 (police) in Egypt, or the local emergency number.");
  }
  const who = state.emergencyName || "the emergency contact";
  let where = "";
  try {
    const p = await currentPosition();
    where = ` Location: https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  } catch {}
  const detail = situation ? ` (${String(situation).slice(0, 100)})` : "";
  const message = `EMERGENCY: automated alert from Jarvis. The owner of this phone needs help${detail}.${where}`;
  const out = { contact: who };
  try { await DeviceActions.sendSmsDirect({ number: state.emergencyNumber, message }); out.textSent = true; }
  catch (e) { out.textError = e.message; }
  try { await DeviceActions.callNumberDirect({ number: state.emergencyNumber }); out.calling = true; }
  catch (e) { out.callError = e.message; }
  out.note = "If life is at risk, also call 123 (ambulance) or 122 (police).";
  return out;
}

/* 18. Offline / out-of-budget commands, handled on the phone itself ------- */
async function tryLocalCommand(raw) {
  const a = state.address;
  const clean = String(raw).trim().replace(/^jarvis[,\s]+/i, "").replace(/[.!?]+$/, "");
  const t = clean.toLowerCase().replace(/^(please|could you|can you|would you)\s+/, "");
  let m;
  try {
    if (/\b(flashlight|torch)\b/.test(t)) {
      const on = !/\b(off|disable|kill)\b/.test(t);
      await setFlashlight(on);
      logActivity(`TORCH ${on ? "ON" : "OFF"}`);
      return `Torch ${on ? "on" : "off"}, ${a}.`;
    }
    if ((m = t.match(/timer (?:for )?(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b|(\d+)[\s-]*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\s+timer/))) {
      const n = parseInt(m[1] || m[3], 10);
      const unit = (m[2] || m[4])[0];
      const secs = n * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
      await setTimer(secs, "Jarvis");
      logActivity(`TIMER ${n}${unit}`);
      return `Timer running: ${n} ${unit === "h" ? "hour" : unit === "m" ? "minute" : "second"}${n === 1 ? "" : "s"}, ${a}.`;
    }
    if ((m = t.match(/(?:alarm|wake me(?: up)?)\s*(?:for|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/))) {
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2] || "0", 10);
      const ap = m[3] ? m[3][0] : "";
      if (ap === "p" && h < 12) h += 12;
      if (ap === "a" && h === 12) h = 0;
      if (h > 23 || min > 59) return null;
      await setAlarm(h, min, "Jarvis");
      logActivity(`ALARM ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
      return `Alarm set for ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}, ${a}.`;
    }
    if (/\bbattery\b/.test(t)) {
      const { level, charging } = await getBatteryStatus();
      return `${level} percent${charging ? " and charging" : ""}, ${a}.`;
    }
    if (/^(what(?:'s| is) the time|what time is it|time)$/.test(t)) {
      return `It's ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, ${a}.`;
    }
    if (/^(what(?:'s| is) (?:the |today's )?date|what day is it|date)$/.test(t)) {
      return `${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${a}.`;
    }
    if ((m = t.match(/volume (?:to |at )?(\d{1,3})\s*(?:%|percent)?$/))) {
      const percent = Math.min(100, parseInt(m[1], 10));
      await DeviceActions.setVolume({ percent });
      logActivity(`VOLUME ${percent}%`);
      return `Volume at ${percent} percent, ${a}.`;
    }
    if (/\b(do not disturb|dnd)\b/.test(t)) {
      const on = !/\b(off|disable|stop|end)\b/.test(t);
      await setDoNotDisturb(on);
      logActivity(`DO NOT DISTURB ${on ? "ON" : "OFF"}`);
      return on ? `Do Not Disturb is on, ${a}. The world can wait.` : `Do Not Disturb is off, ${a}.`;
    }
    if (/\bsilent mode\b/.test(t)) {
      const on = !/\b(off|disable|stop|end)\b/.test(t);
      setSilentMode(on);
      return on ? `Silent mode, ${a}. I'll write rather than speak.` : `Voice restored, ${a}.`;
    }
    if ((m = clean.match(/^(?:take a note|note(?: that| down)?|write (?:this|that) down)[:,]?\s+(.+)/i))) {
      takeNote(m[1]);
      logActivity("NOTE FILED");
      return `Noted, ${a}.`;
    }
    if ((m = clean.match(/^add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(.+?)\s+list$/i))) {
      const r = addToList(m[2], m[1].split(/\s*,\s*|\s+and\s+/));
      logActivity(`${r.list} +${r.added.length}`);
      return `On the ${r.list} list, ${a}.`;
    }
    if ((m = t.match(/^(?:open|launch|start)\s+(?:the\s+)?(.+?)(?:\s+app)?$/))) {
      await DeviceActions.openApp({ name: m[1] });
      logActivity(`LAUNCHING ${m[1].toUpperCase()}`);
      return `${capFirst(m[1])}, ${a}.`;
    }
  } catch (e) {
    return `I couldn't manage that on my own, ${a}: ${e.message}`;
  }
  return null;
}

/* Tools ------------------------------------------------------------------- */
FEATURE_TOOLS.push(
  {
    type: "function",
    function: {
      name: "emergency_protocol",
      description: "EMERGENCY ONLY, when the user says they are in danger, hurt, or explicitly asks for the emergency protocol/SOS. Instantly texts their emergency contact with their location, then calls that contact.",
      parameters: { type: "object", properties: { situation: { type: "string", description: "A few words on what's happening, if said" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "set_silent_mode",
      description: "Silent mode: Jarvis shows replies without speaking them (on), or speaks again (off).",
      parameters: { type: "object", properties: { on: { type: "boolean" } }, required: ["on"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_activity_log",
      description: "What Jarvis has done recently (calls, texts, reminders, settings changed), newest first.",
      parameters: { type: "object", properties: { limit: { type: "integer" } } },
    },
  },
);
Object.assign(FEATURE_HANDLERS, {
  emergency_protocol: a => emergencyProtocol(a),
  set_silent_mode: a => setSilentMode(a.on),
  get_activity_log: a => ({
    actions: state.activityLog.slice(0, clampNum(a.limit, 1, 30, 10)).map(x => ({ when: fmtWhen(x.at), what: x.label })),
  }),
});
Object.assign(FEATURE_LABELS, {
  emergency_protocol: () => "EMERGENCY PROTOCOL ENGAGED",
  set_silent_mode: a => `SILENT MODE ${a.on ? "ON" : "OFF"}`,
  get_activity_log: () => "REVIEWING ACTIVITY LOG",
});
TOOL_GROUPS.safety = {
  about: "emergency protocol",
  tools: ["emergency_protocol"],
  match: /\b(emergency|sos|in danger|i'?m hurt|help me)\b|طوارئ|الحقني|ساعدني|النجدة/i,
};

/* Settings & init --------------------------------------------------------- */
function bindSetting(id, key, { type = "value", onChange } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (type === "checked") el.checked = !!state[key]; else el.value = state[key];
  el.addEventListener("change", () => {
    state[key] = type === "checked" ? el.checked : el.value.trim();
    store.set(key, state[key]);
    if (onChange) onChange(state[key]);
  });
}

async function initPresence() {
  applyHudTheme();
  bindSetting("hudThemeSelect", "hudTheme", { onChange: applyHudTheme });
  bindSetting("witSelect", "wit");
  bindSetting("listenLangSelect", "listenLang");
  bindSetting("hapticsToggle", "haptics", { type: "checked", onChange: on => on && buzz("medium") });
  bindSetting("silentToggle", "silentMode", { type: "checked", onChange: setSilentMode });
  bindSetting("meetingAlertsToggle", "meetingAlerts", { type: "checked" });
  bindSetting("emergencyNameInput", "emergencyName");
  bindSetting("emergencyNumberInput", "emergencyNumber");
  document.querySelectorAll(".tel-mode").forEach(el => { el.hidden = !state.silentMode; });
  renderChips();
  renderActivity();
  // Widgets need the network and a moment's grace after launch.
  setTimeout(() => refreshWidgets().catch(() => {}), 4000);
  setInterval(() => refreshWidgets().catch(() => {}), 15 * 60 * 1000);
  App.addListener("appStateChange", ({ isActive }) => { if (isActive) refreshWidgets().catch(() => {}); });
}
