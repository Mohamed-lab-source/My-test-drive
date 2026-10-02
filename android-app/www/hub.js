/* ======================================================================
 * Jarvis 3.2 — Hub Mode
 *
 * Turns a tablet (or a spare phone) on a stand into a JARVIS dashboard:
 * big clock, date, Hijri date, weather, today's schedule, next prayer, and
 * a glance at reminders and water. Keeps the screen awake and leaves
 * "Hey Jarvis" listening so you can talk to it across the room.
 *
 * Entirely local — no network between devices. Loads after voice.js.
 * ====================================================================== */

let hubWakeLock = null;
let hubClockTimer = null;
let hubDataTimer = null;

async function acquireWakeLock() {
  try {
    if ("wakeLock" in navigator && navigator.wakeLock.request) {
      hubWakeLock = await navigator.wakeLock.request("screen");
      hubWakeLock.addEventListener("release", () => { hubWakeLock = null; });
    }
  } catch { /* some devices refuse; the hub still works, the screen may just dim */ }
}
function releaseWakeLock() {
  try { if (hubWakeLock) hubWakeLock.release(); } catch {}
  hubWakeLock = null;
}

function hubTick() {
  const now = new Date();
  const set = (id, text) => { const e = document.getElementById(id); if (e && e.textContent !== text) e.textContent = text; };
  set("hubClock", `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  set("hubDate", now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  set("hubGreeting", `Good ${partOfDay()}${state.address ? ", " + state.address : ""}.`);
}

async function hubRefreshData() {
  const set = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
  const show = (id, on) => { const e = document.getElementById(id); if (e) e.hidden = !on; };

  // Hijri date
  try { const h = await hijriDate({}); set("hubHijri", h.hijri); } catch {}

  // Weather (home only, never prompts for GPS)
  if (state.homeLoc || (state.places && state.places.home)) {
    try {
      const w = await getWeather();
      set("hubWeatherTemp", `${w.tempC}°`);
      set("hubWeatherDesc", w.description);
      show("hubWeather", true);
    } catch { show("hubWeather", false); }
  }

  // Next prayer
  try {
    const p = await prayerTimes({});
    if (p.next) { set("hubPrayer", `${p.next.name} ${p.next.time}`); show("hubPrayerRow", true); }
  } catch {}

  // Today's events
  const evBox = document.getElementById("hubEvents");
  if (evBox && state.calendarRefreshToken) {
    try {
      const evs = (await listTodayEvents()).filter(e => e.start && e.start.includes("T") && new Date(e.start) >= new Date(Date.now() - 36e5));
      evBox.innerHTML = "";
      if (!evs.length) evBox.appendChild(el("div", "hub-dim", "Nothing left on the calendar today."));
      evs.slice(0, 4).forEach(e => {
        const row = el("div", "hub-event");
        row.append(el("span", "hub-event-time", new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), el("span", "", e.title));
        evBox.appendChild(row);
      });
    } catch {}
  }

  // Reminders + water glance
  const openRem = state.reminders.filter(r => !r.done).length;
  const water = (typeof T === "object" && T.water) ? (T.water.days[localDayKey()] || 0) : 0;
  const goal = (typeof T === "object" && T.water) ? T.water.goal : 8;
  set("hubGlance", `⏰ ${openRem} reminder${openRem === 1 ? "" : "s"}   ·   💧 ${water}/${goal}`);
}

async function enterHub() {
  const hub = document.getElementById("hubView");
  if (!hub) return;
  state.hubMode = true;
  store.set("hubMode", true);
  applyHudTheme();
  hub.hidden = false;
  document.body.classList.add("hub-active");
  hubTick();
  hubRefreshData().catch(() => {});
  clearInterval(hubClockTimer); hubClockTimer = setInterval(hubTick, 1000);
  clearInterval(hubDataTimer); hubDataTimer = setInterval(() => hubRefreshData().catch(() => {}), 5 * 60 * 1000);
  await acquireWakeLock();
  // "Hey Jarvis" is what makes the hub useful hands-free; nudge it on.
  if (!state.wakeWord && typeof setWakeWordEnabled === "function") {
    try { await setWakeWordEnabled(true); } catch {}
  }
}

function exitHub() {
  const hub = document.getElementById("hubView");
  state.hubMode = false;
  store.set("hubMode", false);
  if (hub) hub.hidden = true;
  document.body.classList.remove("hub-active");
  clearInterval(hubClockTimer); hubClockTimer = null;
  clearInterval(hubDataTimer); hubDataTimer = null;
  releaseWakeLock();
}

async function initHub() {
  state.hubMode = await store.get("hubMode", false);
  const toggle = document.getElementById("hubModeToggle");
  if (toggle) {
    toggle.checked = state.hubMode;
    toggle.addEventListener("change", () => { if (toggle.checked) { document.getElementById("settingsView").style.display = "none"; enterHub(); } else exitHub(); });
  }
  const talk = document.getElementById("hubTalk");
  if (talk) talk.addEventListener("click", () => { if (!conversationActive && !busy) { if (speakingNow) stopSpeaking(); conversation(); } });
  const exit = document.getElementById("hubExit");
  if (exit) exit.addEventListener("click", exitHub);
  // Re-acquire the wake lock after the screen was off or the app was backgrounded.
  document.addEventListener("visibilitychange", () => { if (state.hubMode && document.visibilityState === "visible" && !hubWakeLock) acquireWakeLock(); });
  if (state.hubMode) enterHub();
}
