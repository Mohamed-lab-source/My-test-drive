/* =========================================================================
   JARVIS — native Android app (Capacitor WebView)
   Brain: xAI Grok (OpenAI-compatible chat completions + tool calling)
   Voice: native Android speech recognition + text-to-speech plugins
   Calendar: Google OAuth via system browser (PKCE) + Calendar API
   Reminders: real OS-level scheduled notifications (fire even if app closed)
   ========================================================================= */

const { Preferences, Browser, App, LocalNotifications, SpeechRecognition, TextToSpeech } =
  (window.Capacitor && window.Capacitor.Plugins) || {};

/* ---------------------------------------------------------------------- *
 * Storage — Capacitor Preferences (native), loaded into memory at boot
 * ---------------------------------------------------------------------- */
const store = {
  async get(key, fallback) {
    try {
      const { value } = await Preferences.get({ key: "jarvis:" + key });
      return value === null || value === undefined ? fallback : JSON.parse(value);
    } catch { return fallback; }
  },
  set(key, value) {
    // fire-and-forget write; memory copy in `state` is the source of truth for the running session
    try { Preferences.set({ key: "jarvis:" + key, value: JSON.stringify(value) }); } catch {}
  },
};

const state = {
  apiKey: "",
  model: "grok-4-fast",
  oauthClientId: "",
  oauthClientSecret: "",
  homeLoc: "",
  workLoc: "",
  voiceName: "",
  reminders: [],
  chatHistory: [], // OpenAI-style: [{role, content, tool_calls?, tool_call_id?}]
  calendarAccessToken: null,
  calendarRefreshToken: null,
  calendarTokenExpiry: 0,
  reminderIdCounter: 1,
};

async function loadState() {
  state.apiKey = await store.get("apiKey", "");
  state.model = await store.get("model", "grok-4-fast");
  state.oauthClientId = await store.get("oauthClientId", "");
  state.oauthClientSecret = await store.get("oauthClientSecret", "");
  state.homeLoc = await store.get("homeLoc", "");
  state.workLoc = await store.get("workLoc", "");
  state.voiceName = await store.get("voiceName", "");
  state.reminders = await store.get("reminders", []);
  state.chatHistory = await store.get("chatHistory", []);
  state.calendarRefreshToken = await store.get("calendarRefreshToken", null);
  state.reminderIdCounter = await store.get("reminderIdCounter", 1);
}

/* ---------------------------------------------------------------------- *
 * Toast
 * ---------------------------------------------------------------------- */
function toast(msg, ms = 2400) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), ms);
}

/* ---------------------------------------------------------------------- *
 * Tabs / navigation
 * ---------------------------------------------------------------------- */
function wireTabs() {
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
  });
  document.getElementById("closeSettingsBtn").addEventListener("click", () => {
    settingsView.style.display = "none";
  });
  settingsView.style.display = "none";
}

/* ---------------------------------------------------------------------- *
 * Settings wiring
 * ---------------------------------------------------------------------- */
function refreshKeyStatus() {
  const keyStatus = document.getElementById("keyStatus");
  if (state.apiKey) { keyStatus.textContent = "connected"; keyStatus.classList.add("ok"); }
  else { keyStatus.textContent = "not set"; keyStatus.classList.remove("ok"); }
}
function refreshCalStatus() {
  const calStatus = document.getElementById("calStatus");
  if (state.calendarRefreshToken) { calStatus.textContent = "connected"; calStatus.classList.add("ok"); }
  else { calStatus.textContent = "not connected"; calStatus.classList.remove("ok"); }
}

function wireSettingsForm() {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const modelSelect = document.getElementById("modelSelect");
  const oauthClientInput = document.getElementById("oauthClientInput");
  const oauthSecretInput = document.getElementById("oauthSecretInput");
  const homeLocInput = document.getElementById("homeLocInput");
  const workLocInput = document.getElementById("workLocInput");

  apiKeyInput.value = state.apiKey;
  modelSelect.value = state.model;
  oauthClientInput.value = state.oauthClientId;
  oauthSecretInput.value = state.oauthClientSecret;
  homeLocInput.value = state.homeLoc;
  workLocInput.value = state.workLoc;
  refreshKeyStatus();
  refreshCalStatus();

  apiKeyInput.addEventListener("change", () => {
    state.apiKey = apiKeyInput.value.trim();
    store.set("apiKey", state.apiKey);
    refreshKeyStatus();
    toast("API key saved");
  });
  modelSelect.addEventListener("change", () => {
    state.model = modelSelect.value;
    store.set("model", state.model);
  });
  oauthClientInput.addEventListener("change", () => {
    state.oauthClientId = oauthClientInput.value.trim();
    store.set("oauthClientId", state.oauthClientId);
  });
  oauthSecretInput.addEventListener("change", () => {
    state.oauthClientSecret = oauthSecretInput.value.trim();
    store.set("oauthClientSecret", state.oauthClientSecret);
  });
  homeLocInput.addEventListener("change", () => {
    state.homeLoc = homeLocInput.value.trim();
    store.set("homeLoc", state.homeLoc);
  });
  workLocInput.addEventListener("change", () => {
    state.workLoc = workLocInput.value.trim();
    store.set("workLoc", state.workLoc);
  });

  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("Erase all Jarvis data on this device (API key, reminders, chat history, settings)?")) return;
    await Preferences.clear();
    location.reload();
  });

  document.getElementById("connectCalBtn").addEventListener("click", connectCalendar);
}

/* Voices (native TTS) */
async function populateVoices() {
  const voiceSelect = document.getElementById("voiceSelect");
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    const enVoices = (voices || []).filter(v => (v.lang || "").startsWith("en"));
    voiceSelect.innerHTML = "";
    enVoices.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI || v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (opt.value === state.voiceName) opt.selected = true;
      voiceSelect.appendChild(opt);
    });
    if (!enVoices.length) voiceSelect.innerHTML = `<option value="">Default device voice</option>`;
  } catch {
    voiceSelect.innerHTML = `<option value="">Default device voice</option>`;
  }
  voiceSelect.addEventListener("change", () => {
    state.voiceName = voiceSelect.value;
    store.set("voiceName", state.voiceName);
  });
}

async function speak(text) {
  try {
    await TextToSpeech.speak({
      text,
      lang: "en-US",
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: "ambient",
      voice: state.voiceName || undefined,
    });
  } catch (e) { console.warn("TTS failed", e); }
}

/* ---------------------------------------------------------------------- *
 * Google OAuth for Calendar — system browser + PKCE (works around
 * Google's block on OAuth inside embedded app WebViews)
 * ---------------------------------------------------------------------- */
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
const REDIRECT_URI = "com.jarvis.secretary://oauth2redirect";
let pendingPkce = null;

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64url(arr.buffer);
}
async function sha256(str) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
}

async function connectCalendar() {
  if (!state.oauthClientId || !state.oauthClientSecret) {
    toast("Add your Google OAuth Client ID and Secret first — see README");
    return;
  }
  const verifier = randomVerifier();
  const challenge = base64url(await sha256(verifier));
  pendingPkce = { verifier };

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", state.oauthClientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", CAL_SCOPE);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  await Browser.open({ url: authUrl.toString() });
}

async function handleOAuthRedirect(url) {
  if (!url.startsWith(REDIRECT_URI)) return;
  try { await Browser.close(); } catch {}
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const error = parsed.searchParams.get("error");
  if (error) { toast(`Calendar sign-in failed: ${error}`); return; }
  if (!code || !pendingPkce) return;

  try {
    const body = new URLSearchParams({
      client_id: state.oauthClientId,
      client_secret: state.oauthClientSecret,
      code,
      code_verifier: pendingPkce.verifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || "token exchange failed");
    state.calendarAccessToken = data.access_token;
    state.calendarTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    if (data.refresh_token) {
      state.calendarRefreshToken = data.refresh_token;
      store.set("calendarRefreshToken", state.calendarRefreshToken);
    }
    refreshCalStatus();
    toast("Calendar connected");
    refreshCalendarCard();
  } catch (e) {
    toast(`Calendar sign-in failed: ${e.message}`);
  } finally {
    pendingPkce = null;
  }
}

async function ensureCalendarToken() {
  if (state.calendarAccessToken && Date.now() < state.calendarTokenExpiry - 30000) {
    return state.calendarAccessToken;
  }
  if (!state.calendarRefreshToken) throw new Error("Calendar not connected. Ask the user to connect it in Settings.");
  const body = new URLSearchParams({
    client_id: state.oauthClientId,
    client_secret: state.oauthClientSecret,
    refresh_token: state.calendarRefreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "couldn't refresh calendar access");
  state.calendarAccessToken = data.access_token;
  state.calendarTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return state.calendarAccessToken;
}

async function calendarFetch(path, opts = {}) {
  const token = await ensureCalendarToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Calendar API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listTodayEvents() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: start.toISOString(), timeMax: end.toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "20",
  });
  const data = await calendarFetch(`calendars/primary/events?${params.toString()}`);
  return (data.items || []).map(ev => ({
    id: ev.id, title: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date, end: ev.end?.dateTime || ev.end?.date,
  }));
}

async function createCalendarEvent({ title, start, end, description }) {
  const body = {
    summary: title, description: description || "",
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end || new Date(new Date(start).getTime() + 60 * 60000)).toISOString() },
  };
  const data = await calendarFetch("calendars/primary/events", { method: "POST", body: JSON.stringify(body) });
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
    location: geo.label, tempC: Math.round(c.temperature_2m),
    description: WEATHER_CODES[c.weather_code] || "Unknown", windKph: Math.round(c.wind_speed_10m || 0),
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
  return { from: og.label, to: dg.label, minutes: Math.round(route.duration / 60), km: Math.round(route.distance / 100) / 10 };
}

/* ---------------------------------------------------------------------- *
 * Reminders — real OS notifications via @capacitor/local-notifications
 * ---------------------------------------------------------------------- */
function saveReminders() { store.set("reminders", state.reminders); }
function nextReminderId() {
  const id = state.reminderIdCounter++;
  store.set("reminderIdCounter", state.reminderIdCounter);
  return id;
}

async function ensureNotifyPermission() {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch { return false; }
}

async function addReminder(text, whenIso) {
  const id = nextReminderId();
  const r = { id, text, time: whenIso || null, done: false };
  state.reminders.push(r);
  saveReminders();
  renderReminders();
  if (whenIso && new Date(whenIso).getTime() > Date.now()) {
    const granted = await ensureNotifyPermission();
    if (granted) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id, title: "Jarvis reminder", body: text,
            schedule: { at: new Date(whenIso) },
            smallIcon: "ic_stat_jarvis",
          }],
        });
      } catch (e) { console.warn("schedule failed", e); }
    } else {
      toast("Notification permission denied — reminder saved but won't alert you");
    }
  }
  return r;
}

async function deleteReminder(id) {
  state.reminders = state.reminders.filter(r => r.id !== id);
  saveReminders();
  renderReminders();
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
}
async function toggleReminder(id) {
  const r = state.reminders.find(r => r.id === id);
  if (!r) return;
  r.done = !r.done;
  saveReminders();
  renderReminders();
  if (r.done) { try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {} }
}

function fmtWhen(iso) {
  if (!iso) return "no due time";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderReminders() {
  const list = document.getElementById("reminderList");
  const upcoming = [...state.reminders].sort((a, b) => (a.time || "9999") < (b.time || "9999") ? -1 : 1);
  if (!upcoming.length) { list.innerHTML = `<div class="empty-hint">No reminders yet.</div>`; return; }
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

function wireReminderForm() {
  document.getElementById("addReminderBtn").addEventListener("click", async () => {
    const text = document.getElementById("reminderInput").value.trim();
    const time = document.getElementById("reminderTime").value;
    if (!text) { toast("Type a reminder first"); return; }
    await addReminder(text, time ? new Date(time).toISOString() : null);
    document.getElementById("reminderInput").value = "";
    document.getElementById("reminderTime").value = "";
    toast("Reminder added");
  });
}

/* ---------------------------------------------------------------------- *
 * Grok (xAI) brain — OpenAI-compatible chat completions + tool calling
 * ---------------------------------------------------------------------- */
const SYSTEM_PROMPT = `You are Jarvis, a sharp, warm, slightly witty personal secretary living on the user's phone.
Be concise and conversational — you're spoken aloud as often as read. Use tools whenever the user's request needs
live information (weather, calendar, commute, reminders) rather than guessing. When creating calendar events,
confirm the details back to the user in your reply. Never invent calendar events, weather, or commute data —
always call the matching tool. If a tool fails because something isn't connected/set, tell the user plainly what
to set up in Settings. Keep replies short by default; give more detail only if asked.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a location (defaults to the user's home location if omitted).",
      parameters: { type: "object", properties: { location: { type: "string", description: "City name" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_commute_time",
      description: "Get estimated driving time between two places (defaults to home -> work).",
      parameters: {
        type: "object",
        properties: { origin: { type: "string" }, destination: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_events",
      description: "List the user's Google Calendar events for today. Requires calendar to be connected.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new Google Calendar event. Requires calendar to be connected.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start: { type: "string", description: "ISO 8601 datetime" },
          end: { type: "string", description: "ISO 8601 datetime, optional" },
          description: { type: "string" },
        },
        required: ["title", "start"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_reminder",
      description: "Add a reminder/to-do for the user, optionally with a due date/time. Fires a real notification even if the app is closed.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" }, when: { type: "string", description: "ISO 8601 datetime, optional" } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List the user's current open reminders.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeTool(name, args) {
  switch (name) {
    case "get_weather": return await getWeather(args.location);
    case "get_commute_time": return await getCommuteTime(args.origin, args.destination);
    case "list_today_events": return { events: await listTodayEvents() };
    case "create_calendar_event": return await createCalendarEvent(args);
    case "add_reminder": { const r = await addReminder(args.text, args.when || null); return { added: true, reminder: r }; }
    case "list_reminders": return { reminders: state.reminders.filter(r => !r.done) };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function callGrok(messages) {
  if (!state.apiKey) throw new Error("NO_API_KEY");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.apiKey}` },
    body: JSON.stringify({ model: state.model, messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) throw new Error(`Grok API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function runAgentTurn(userText) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...state.chatHistory,
    { role: "user", content: userText },
  ];
  let guard = 0;
  while (guard++ < 6) {
    let data;
    try { data = await callGrok(messages); }
    catch (e) {
      if (String(e.message).includes("NO_API_KEY")) {
        return { text: "I don't have a Grok API key yet. Add one in Settings and I'll be right with you.", messages };
      }
      return { text: `I hit an error talking to my brain: ${e.message}`, messages };
    }
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) return { text: "I didn't get a response — try again in a moment.", messages };

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        const name = call.function.name;
        let args = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch {}
        addToolMsg(`→ ${name}(${JSON.stringify(args)})`);
        let result;
        try { result = await executeTool(name, args); } catch (e) { result = { error: e.message }; }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }
    const text = (msg.content || "").trim() || "…";
    messages.push({ role: "assistant", content: text });
    return { text, messages };
  }
  return { text: "That took too many steps — let's try a simpler request.", messages };
}

/* ---------------------------------------------------------------------- *
 * Chat UI
 * ---------------------------------------------------------------------- */
function addMsg(role, text) {
  const chatLog = document.getElementById("chatLog");
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
    if (turn.role === "user") addMsg("user", turn.content);
    else if (turn.role === "assistant" && turn.content) addMsg("assistant", turn.content);
  });
}

let sending = false;
let lastInputWasVoice = false;

async function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const text = chatInput.value.trim();
  if (!text || sending) return;
  sending = true;
  chatInput.value = "";
  chatInput.style.height = "auto";
  addMsg("user", text);
  const thinking = addMsg("assistant", "…");
  try {
    const { text: reply, messages } = await runAgentTurn(text);
    thinking.textContent = reply;
    // strip system prompt before persisting; keep last ~30 turns
    state.chatHistory = messages.filter(m => m.role !== "system").slice(-30);
    store.set("chatHistory", state.chatHistory);
    if (lastInputWasVoice) speak(reply);
  } catch (e) {
    thinking.textContent = `Error: ${e.message}`;
  } finally {
    sending = false;
    lastInputWasVoice = false;
  }
}

function wireChat() {
  const chatInput = document.getElementById("chatInput");
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
  });
}

/* ---------------------------------------------------------------------- *
 * Native voice input
 * ---------------------------------------------------------------------- */
function wireMic() {
  const micBtn = document.getElementById("micBtn");
  let listening = false;

  micBtn.addEventListener("click", async () => {
    if (listening) return;
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) { toast("Speech recognition isn't available on this device"); return; }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") { toast("Microphone permission denied"); return; }

      listening = true;
      micBtn.classList.add("listening");
      const result = await SpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        prompt: "Speak to Jarvis...",
        partialResults: false,
        popup: false,
      });
      const transcript = result && result.matches && result.matches[0];
      if (transcript) {
        document.getElementById("chatInput").value = transcript;
        lastInputWasVoice = true;
        sendMessage();
      }
    } catch (e) {
      console.warn("speech recognition error", e);
      toast("Didn't catch that — try again");
    } finally {
      listening = false;
      micBtn.classList.remove("listening");
    }
  });
}

/* ---------------------------------------------------------------------- *
 * Briefing tab
 * ---------------------------------------------------------------------- */
async function refreshCalendarCard() {
  const list = document.getElementById("calendarList");
  if (!state.calendarRefreshToken) {
    list.innerHTML = `<div class="empty-hint">Connect Google Calendar in Settings to see today's events here.</div>`;
    return [];
  }
  try {
    const events = await listTodayEvents();
    if (!events.length) { list.innerHTML = `<div class="empty-hint">Nothing on the calendar today. 🎉</div>`; return events; }
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

  if (state.homeLoc) {
    try {
      const w = await getWeather();
      results.weather = w;
      document.getElementById("weatherCard").style.display = "block";
      document.getElementById("weatherTemp").textContent = `${w.tempC}°C`;
      document.getElementById("weatherDesc").textContent = `${w.description} in ${w.location} · wind ${w.windKph} km/h`;
    } catch (e) { toast(`Weather: ${e.message}`); }
  }

  if (state.homeLoc && state.workLoc) {
    try {
      const c = await getCommuteTime();
      results.commute = c;
      document.getElementById("commuteCard").style.display = "block";
      document.getElementById("commuteTime").textContent = `${c.minutes} min`;
      document.getElementById("commuteDesc").textContent = `${c.from} → ${c.to} (${c.km} km)`;
    } catch (e) { toast(`Commute: ${e.message}`); }
  }

  results.events = await refreshCalendarCard();
  results.reminders = state.reminders.filter(r => !r.done);

  const lines = [];
  const hour = new Date().getHours();
  lines.push(`${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}. `);
  if (results.weather) lines.push(`It's ${results.weather.tempC}°C and ${results.weather.description.toLowerCase()} in ${results.weather.location}. `);
  lines.push(results.events.length
    ? `You have ${results.events.length} thing${results.events.length > 1 ? "s" : ""} on today: ${results.events.map(e => e.title).join(", ")}. `
    : `Your calendar is clear today. `);
  if (results.commute) lines.push(`Commute to ${results.commute.to.split(",")[0]} is about ${results.commute.minutes} minutes. `);
  if (results.reminders.length) lines.push(`You have ${results.reminders.length} open reminder${results.reminders.length > 1 ? "s" : ""}: ${results.reminders.slice(0, 3).map(r => r.text).join(", ")}. `);

  const briefing = lines.join("");
  document.getElementById("briefingTextCard").style.display = "block";
  document.getElementById("briefingText").textContent = briefing;
  speak(briefing);

  btn.textContent = "☀️ Get My Morning Briefing";
  btn.disabled = false;
}

function wireBriefing() {
  document.getElementById("runBriefingBtn").addEventListener("click", runBriefing);
}

/* ---------------------------------------------------------------------- *
 * App lifecycle — deep link handling for OAuth redirect
 * ---------------------------------------------------------------------- */
function wireDeepLinks() {
  App.addListener("appUrlOpen", ({ url }) => handleOAuthRedirect(url));
}

/* ---------------------------------------------------------------------- *
 * Boot
 * ---------------------------------------------------------------------- */
async function boot() {
  await loadState();
  wireTabs();
  wireSettingsForm();
  wireReminderForm();
  wireChat();
  wireMic();
  wireBriefing();
  wireDeepLinks();
  await populateVoices();
  renderHistoryOnLoad();
  renderReminders();
  refreshCalendarCard();
}

document.addEventListener("DOMContentLoaded", boot);
