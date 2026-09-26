/* =========================================================================
   JARVIS — personal AI secretary PWA
   Vanilla JS, no build step. Everything runs in the browser.
   ========================================================================= */

/* ---------------------------------------------------------------------- *
 * Storage helpers
 * ---------------------------------------------------------------------- */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("jarvis:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("jarvis:" + key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem("jarvis:" + key); } catch {}
  }
};

const state = {
  apiKey: store.get("apiKey", ""),
  oauthClientId: store.get("oauthClientId", ""),
  homeLoc: store.get("homeLoc", ""),
  workLoc: store.get("workLoc", ""),
  voiceName: store.get("voiceName", ""),
  wakeMode: store.get("wakeMode", "off"),
  calendarToken: null, // access token, memory-only
  reminders: store.get("reminders", []),
  chatHistory: store.get("chatHistory", []), // [{role:'user'|'model', parts:[{text}]}]
};

/* ---------------------------------------------------------------------- *
 * Toast
 * ---------------------------------------------------------------------- */
function toast(msg, ms = 2200) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), ms);
}

/* ---------------------------------------------------------------------- *
 * Tabs / navigation
 * ---------------------------------------------------------------------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.view).classList.add("active");
  });
});

const settingsView = document.getElementById("settingsView");
document.getElementById("settingsBtn").addEventListener("click", () => {
  settingsView.style.display = "flex";
  settingsView.classList.add("active");
});
document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  settingsView.style.display = "none";
});
settingsView.style.display = "none";

/* ---------------------------------------------------------------------- *
 * Settings wiring
 * ---------------------------------------------------------------------- */
const apiKeyInput = document.getElementById("apiKeyInput");
const keyStatus = document.getElementById("keyStatus");
const oauthClientInput = document.getElementById("oauthClientInput");
const homeLocInput = document.getElementById("homeLocInput");
const workLocInput = document.getElementById("workLocInput");
const wakeModeSelect = document.getElementById("wakeModeSelect");
const voiceSelect = document.getElementById("voiceSelect");
const calStatus = document.getElementById("calStatus");

function refreshKeyStatus() {
  if (state.apiKey) {
    keyStatus.textContent = "connected";
    keyStatus.classList.add("ok");
  } else {
    keyStatus.textContent = "not set";
    keyStatus.classList.remove("ok");
  }
}

apiKeyInput.value = state.apiKey;
oauthClientInput.value = state.oauthClientId;
homeLocInput.value = state.homeLoc;
workLocInput.value = state.workLoc;
wakeModeSelect.value = state.wakeMode;
refreshKeyStatus();

apiKeyInput.addEventListener("change", () => {
  state.apiKey = apiKeyInput.value.trim();
  store.set("apiKey", state.apiKey);
  refreshKeyStatus();
  toast("API key saved");
});
oauthClientInput.addEventListener("change", () => {
  state.oauthClientId = oauthClientInput.value.trim();
  store.set("oauthClientId", state.oauthClientId);
  toast("Client ID saved");
});
homeLocInput.addEventListener("change", () => {
  state.homeLoc = homeLocInput.value.trim();
  store.set("homeLoc", state.homeLoc);
});
workLocInput.addEventListener("change", () => {
  state.workLoc = workLocInput.value.trim();
  store.set("workLoc", state.workLoc);
});
wakeModeSelect.addEventListener("change", () => {
  state.wakeMode = wakeModeSelect.value;
  store.set("wakeMode", state.wakeMode);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Erase all Jarvis data on this device (API key, reminders, chat history, settings)?")) return;
  localStorage.clear();
  location.reload();
});

/* Voices */
function populateVoices() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
  voiceSelect.innerHTML = "";
  voices.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.name === state.voiceName) opt.selected = true;
    voiceSelect.appendChild(opt);
  });
}
speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();
voiceSelect.addEventListener("change", () => {
  state.voiceName = voiceSelect.value;
  store.set("voiceName", state.voiceName);
});

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const chosen = voices.find(v => v.name === state.voiceName);
    if (chosen) u.voice = chosen;
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch {}
}

/* ---------------------------------------------------------------------- *
 * Google OAuth (Calendar) — Google Identity Services
 * ---------------------------------------------------------------------- */
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
let gisReady = false;
let tokenClient = null;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function connectCalendar() {
  if (!state.oauthClientId) {
    toast("Add your Google OAuth Client ID first — see README");
    return;
  }
  try {
    await loadGisScript();
  } catch {
    toast("Couldn't reach Google — check connection");
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.oauthClientId,
    scope: CAL_SCOPE,
    callback: (resp) => {
      if (resp && resp.access_token) {
        state.calendarToken = resp.access_token;
        calStatus.textContent = "connected";
        calStatus.classList.add("ok");
        toast("Calendar connected");
        refreshCalendarCard();
      } else {
        toast("Calendar connection failed");
      }
    },
  });
  tokenClient.requestAccessToken();
}
document.getElementById("connectCalBtn").addEventListener("click", connectCalendar);

async function calendarFetch(path, opts = {}) {
  if (!state.calendarToken) throw new Error("Calendar not connected. Ask the user to connect it in Settings.");
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${state.calendarToken}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function listTodayEvents() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  const data = await calendarFetch(`calendars/primary/events?${params.toString()}`);
  return (data.items || []).map(ev => ({
    id: ev.id,
    title: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
  }));
}

async function createCalendarEvent({ title, start, end, description }) {
  const body = {
    summary: title,
    description: description || "",
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end || new Date(new Date(start).getTime() + 60 * 60000)).toISOString() },
  };
  const data = await calendarFetch("calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: data.id, htmlLink: data.htmlLink, summary: data.summary };
}

/* ---------------------------------------------------------------------- *
 * Weather (Open-Meteo — free, no API key)
 * ---------------------------------------------------------------------- */
async function geocode(place) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error(`Couldn't find location "${place}"`);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, label: `${r.name}, ${r.country || ""}`.trim() };
}

const WEATHER_CODES = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
  75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail",
};

async function getWeather(location) {
  const place = location || state.homeLoc;
  if (!place) throw new Error("No location set. Ask the user for their city or set Home Location in Settings.");
  const geo = await geocode(place);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`;
  const res = await fetch(url);
  const data = await res.json();
  const c = data.current || {};
  return {
    location: geo.label,
    tempC: Math.round(c.temperature_2m),
    description: WEATHER_CODES[c.weather_code] || "Unknown",
    windKph: Math.round(c.wind_speed_10m || 0),
  };
}

/* ---------------------------------------------------------------------- *
 * Commute (OSRM public routing — free, no API key)
 * ---------------------------------------------------------------------- */
async function getCommuteTime(origin, destination) {
  const o = origin || state.homeLoc;
  const d = destination || state.workLoc;
  if (!o || !d) throw new Error("Home/work location not set. Ask the user to set them in Settings.");
  const [og, dg] = await Promise.all([geocode(o), geocode(d)]);
  const url = `https://router.project-osrm.org/route/v1/driving/${og.lon},${og.lat};${dg.lon},${dg.lat}?overview=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes || !data.routes.length) throw new Error("Couldn't calculate a route between those locations.");
  const route = data.routes[0];
  return {
    from: og.label,
    to: dg.label,
    minutes: Math.round(route.duration / 60),
    km: Math.round(route.distance / 100) / 10,
  };
}

/* ---------------------------------------------------------------------- *
 * Reminders (stored locally, best-effort notifications)
 * ---------------------------------------------------------------------- */
function saveReminders() { store.set("reminders", state.reminders); }

function addReminder(text, whenIso) {
  const r = { id: Date.now().toString(36), text, time: whenIso || null, done: false, notified: false };
  state.reminders.push(r);
  saveReminders();
  renderReminders();
  scheduleReminderCheck(r);
  return r;
}
function deleteReminder(id) {
  state.reminders = state.reminders.filter(r => r.id !== id);
  saveReminders();
  renderReminders();
}
function toggleReminder(id) {
  const r = state.reminders.find(r => r.id === id);
  if (r) { r.done = !r.done; saveReminders(); renderReminders(); }
}

function fmtWhen(iso) {
  if (!iso) return "no due time";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}

function renderReminders() {
  const list = document.getElementById("reminderList");
  const upcoming = [...state.reminders].sort((a, b) => (a.time || "9999") < (b.time || "9999") ? -1 : 1);
  if (!upcoming.length) {
    list.innerHTML = `<div class="empty-hint">No reminders yet.</div>`;
    return;
  }
  list.innerHTML = "";
  upcoming.forEach(r => {
    const row = document.createElement("div");
    row.className = "reminder-row";
    row.innerHTML = `
      <div style="flex:1; cursor:pointer;" class="${r.done ? "reminder-done" : ""}">
        <div>${escapeHtml(r.text)}</div>
        <div class="sub-stat">${fmtWhen(r.time)}</div>
      </div>
      <button class="del-btn" title="Delete">🗑️</button>
    `;
    row.querySelector("div").addEventListener("click", () => toggleReminder(r.id));
    row.querySelector(".del-btn").addEventListener("click", () => deleteReminder(r.id));
    list.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function ensureNotifyPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}

function scheduleReminderCheck(r) {
  if (!r.time) return;
  const ms = new Date(r.time).getTime() - Date.now();
  if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return; // only schedule if within 24h and app stays open
  setTimeout(async () => {
    const fresh = state.reminders.find(x => x.id === r.id);
    if (!fresh || fresh.done || fresh.notified) return;
    fresh.notified = true;
    saveReminders();
    if (await ensureNotifyPermission()) {
      new Notification("Jarvis reminder", { body: fresh.text, icon: "icons/icon-192.png" });
    }
    speak(`Reminder: ${fresh.text}`);
  }, ms);
}

function checkOverdueReminders() {
  const now = Date.now();
  state.reminders.forEach(r => {
    if (r.time && !r.done) {
      if (new Date(r.time).getTime() <= now && !r.notified) {
        r.notified = true;
      } else if (new Date(r.time).getTime() > now) {
        scheduleReminderCheck(r);
      }
    }
  });
  saveReminders();
}

document.getElementById("addReminderBtn").addEventListener("click", () => {
  const text = document.getElementById("reminderInput").value.trim();
  const time = document.getElementById("reminderTime").value;
  if (!text) { toast("Type a reminder first"); return; }
  addReminder(text, time ? new Date(time).toISOString() : null);
  document.getElementById("reminderInput").value = "";
  document.getElementById("reminderTime").value = "";
  ensureNotifyPermission();
  toast("Reminder added");
});

renderReminders();
checkOverdueReminders();

/* ---------------------------------------------------------------------- *
 * Gemini brain — function calling loop
 * ---------------------------------------------------------------------- */
const GEMINI_MODEL = "gemini-2.0-flash";
const SYSTEM_PROMPT = `You are Jarvis, a sharp, warm, slightly witty personal secretary living on the user's phone.
Be concise and conversational — you're spoken aloud as often as read. Use tools whenever the user's request needs
live information (weather, calendar, commute, reminders) rather than guessing. When creating calendar events,
confirm the details back to the user in your reply. Never invent calendar events, weather, or commute data —
always call the matching tool. If a tool fails because something isn't connected/set, tell the user plainly what
to set up in Settings. Keep replies short by default; give more detail only if asked.`;

const TOOLS = [{
  functionDeclarations: [
    {
      name: "get_weather",
      description: "Get current weather for a location (defaults to the user's home location if omitted).",
      parameters: { type: "OBJECT", properties: { location: { type: "STRING", description: "City name" } } },
    },
    {
      name: "get_commute_time",
      description: "Get estimated driving time between two places (defaults to home -> work).",
      parameters: {
        type: "OBJECT",
        properties: {
          origin: { type: "STRING", description: "Start location" },
          destination: { type: "STRING", description: "End location" },
        },
      },
    },
    {
      name: "list_today_events",
      description: "List the user's Google Calendar events for today. Requires calendar to be connected.",
      parameters: { type: "OBJECT", properties: {} },
    },
    {
      name: "create_calendar_event",
      description: "Create a new Google Calendar event. Requires calendar to be connected.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          start: { type: "STRING", description: "ISO 8601 datetime, e.g. 2025-06-01T15:00:00" },
          end: { type: "STRING", description: "ISO 8601 datetime, optional, defaults to 1 hour after start" },
          description: { type: "STRING" },
        },
        required: ["title", "start"],
      },
    },
    {
      name: "add_reminder",
      description: "Add a reminder/to-do for the user, optionally with a due date/time.",
      parameters: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          when: { type: "STRING", description: "ISO 8601 datetime, optional" },
        },
        required: ["text"],
      },
    },
    {
      name: "list_reminders",
      description: "List the user's current reminders.",
      parameters: { type: "OBJECT", properties: {} },
    },
  ],
}];

async function executeTool(name, args) {
  switch (name) {
    case "get_weather": return await getWeather(args.location);
    case "get_commute_time": return await getCommuteTime(args.origin, args.destination);
    case "list_today_events": return { events: await listTodayEvents() };
    case "create_calendar_event": return await createCalendarEvent(args);
    case "add_reminder": {
      const r = addReminder(args.text, args.when || null);
      return { added: true, reminder: r };
    }
    case "list_reminders": return { reminders: state.reminders.filter(r => !r.done) };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function callGemini(contents) {
  if (!state.apiKey) throw new Error("NO_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${state.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: TOOLS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function runAgentTurn(userText) {
  const contents = [...state.chatHistory, { role: "user", parts: [{ text: userText }] }];
  let guard = 0;
  while (guard++ < 6) {
    let data;
    try {
      data = await callGemini(contents);
    } catch (e) {
      if (String(e.message).includes("NO_API_KEY")) {
        return { text: "I don't have a Gemini API key yet. Add a free one in Settings and I'll be right with you.", contents };
      }
      return { text: `I hit an error talking to my brain: ${e.message}`, contents };
    }
    const cand = data.candidates && data.candidates[0];
    if (!cand) return { text: "I didn't get a response — try again in a moment.", contents };
    const parts = cand.content?.parts || [];
    const fnCall = parts.find(p => p.functionCall);
    if (fnCall) {
      contents.push({ role: "model", parts });
      const { name, args } = fnCall.functionCall;
      addToolMsg(`→ ${name}(${JSON.stringify(args || {})})`);
      let result;
      try {
        result = await executeTool(name, args || {});
      } catch (e) {
        result = { error: e.message };
      }
      contents.push({ role: "function", parts: [{ functionResponse: { name, response: { result } } }] });
      continue;
    }
    const text = parts.map(p => p.text || "").join("").trim() || "…";
    contents.push({ role: "model", parts: [{ text }] });
    return { text, contents };
  }
  return { text: "That took too many steps — let's try a simpler request.", contents };
}

/* ---------------------------------------------------------------------- *
 * Chat UI
 * ---------------------------------------------------------------------- */
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}
function addToolMsg(text) { addMsg("tool", text); }

function renderHistoryOnLoad() {
  if (!state.chatHistory.length) {
    addMsg("system", "Jarvis is online. Ask me about your day, calendar, weather, or commute.");
    return;
  }
  state.chatHistory.forEach(turn => {
    if (turn.role === "user") addMsg("user", turn.parts.map(p => p.text || "").join(""));
    else if (turn.role === "model") {
      const t = turn.parts.map(p => p.text || "").join("").trim();
      if (t) addMsg("assistant", t);
    }
  });
}
renderHistoryOnLoad();

let sending = false;
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || sending) return;
  sending = true;
  chatInput.value = "";
  chatInput.style.height = "auto";
  addMsg("user", text);
  const thinking = addMsg("assistant", "…");
  try {
    const { text: reply, contents } = await runAgentTurn(text);
    thinking.textContent = reply;
    state.chatHistory = contents;
    store.set("chatHistory", state.chatHistory.slice(-40)); // cap history
    if (state.wakeMode === "listen" || lastInputWasVoice) speak(reply);
  } catch (e) {
    thinking.textContent = `Error: ${e.message}`;
  } finally {
    sending = false;
    lastInputWasVoice = false;
  }
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
});

/* ---------------------------------------------------------------------- *
 * Voice input (Web Speech API)
 * ---------------------------------------------------------------------- */
const micBtn = document.getElementById("micBtn");
let recognition = null;
let listening = false;
let lastInputWasVoice = false;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRec) {
  recognition = new SpeechRec();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    chatInput.value = transcript;
    lastInputWasVoice = true;
    sendMessage();
  };
  recognition.onerror = () => stopListening();
  recognition.onend = () => stopListening();
} else {
  micBtn.style.display = "none";
}

function startListening() {
  if (!recognition) return;
  try {
    recognition.start();
    listening = true;
    micBtn.classList.add("listening");
  } catch {}
}
function stopListening() {
  listening = false;
  micBtn.classList.remove("listening");
}
micBtn.addEventListener("click", () => {
  if (listening) { recognition.stop(); stopListening(); }
  else startListening();
});

/* ---------------------------------------------------------------------- *
 * Briefing tab
 * ---------------------------------------------------------------------- */
async function refreshCalendarCard() {
  const list = document.getElementById("calendarList");
  if (!state.calendarToken) {
    list.innerHTML = `<div class="empty-hint">Connect Google Calendar in Settings to see today's events here.</div>`;
    return [];
  }
  try {
    const events = await listTodayEvents();
    if (!events.length) {
      list.innerHTML = `<div class="empty-hint">Nothing on the calendar today. 🎉</div>`;
      return events;
    }
    list.innerHTML = "";
    events.forEach(ev => {
      const row = document.createElement("div");
      row.className = "event-row";
      const time = ev.start && ev.start.includes("T")
        ? new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : "All day";
      row.innerHTML = `<div class="event-time">${time}</div><div class="event-title">${escapeHtml(ev.title)}</div>`;
      list.appendChild(row);
    });
    return events;
  } catch (e) {
    list.innerHTML = `<div class="empty-hint">Couldn't load calendar: ${escapeHtml(e.message)}</div>`;
    return [];
  }
}

async function runBriefing() {
  const btn = document.getElementById("runBriefingBtn");
  btn.textContent = "⏳ Gathering your briefing...";
  btn.disabled = true;

  const results = { weather: null, commute: null, events: [], reminders: [] };

  // Weather
  if (state.homeLoc) {
    try {
      const w = await getWeather();
      results.weather = w;
      document.getElementById("weatherCard").style.display = "block";
      document.getElementById("weatherTemp").textContent = `${w.tempC}°C`;
      document.getElementById("weatherDesc").textContent = `${w.description} in ${w.location} · wind ${w.windKph} km/h`;
    } catch (e) { toast(`Weather: ${e.message}`); }
  }

  // Commute
  if (state.homeLoc && state.workLoc) {
    try {
      const c = await getCommuteTime();
      results.commute = c;
      document.getElementById("commuteCard").style.display = "block";
      document.getElementById("commuteTime").textContent = `${c.minutes} min`;
      document.getElementById("commuteDesc").textContent = `${c.from} → ${c.to} (${c.km} km)`;
    } catch (e) { toast(`Commute: ${e.message}`); }
  }

  // Calendar
  results.events = await refreshCalendarCard();

  // Reminders
  results.reminders = state.reminders.filter(r => !r.done);

  // Compose spoken briefing
  const lines = [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  lines.push(`${greeting}. `);
  if (results.weather) lines.push(`It's ${results.weather.tempC}°C and ${results.weather.description.toLowerCase()} in ${results.weather.location}. `);
  if (results.events.length) {
    lines.push(`You have ${results.events.length} thing${results.events.length > 1 ? "s" : ""} on today: ` +
      results.events.map(e => e.title).join(", ") + ". ");
  } else {
    lines.push(`Your calendar is clear today. `);
  }
  if (results.commute) lines.push(`Commute to ${results.commute.to.split(",")[0]} is about ${results.commute.minutes} minutes. `);
  if (results.reminders.length) {
    lines.push(`You have ${results.reminders.length} open reminder${results.reminders.length > 1 ? "s" : ""}: ` +
      results.reminders.slice(0, 3).map(r => r.text).join(", ") + ". ");
  }
  const briefing = lines.join("");

  document.getElementById("briefingTextCard").style.display = "block";
  document.getElementById("briefingText").textContent = briefing;
  speak(briefing);

  btn.textContent = "☀️ Get My Morning Briefing";
  btn.disabled = false;
}
document.getElementById("runBriefingBtn").addEventListener("click", runBriefing);

/* Load calendar card on start if a token already exists this session (it won't persist across reloads by design) */
refreshCalendarCard();

/* ---------------------------------------------------------------------- *
 * Service worker (installability + offline shell)
 * ---------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
