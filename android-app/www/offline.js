/* ======================================================================
 * Jarvis 3.6 — a bigger offline brain
 *
 * Most of Jarvis's ACTIONS are local (calling, texting, trackers, maths,
 * conversions, protocols, azkar, notes…) — they only needed the online AI
 * to route to them. This wraps the offline command parser so dozens more
 * commands work with no internet (and when Groq is out of budget).
 * Loads after scribe.js. Each rule returns a spoken reply, or null to pass.
 * ====================================================================== */

(function () {
  const A = () => state.address;
  const num = s => { const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

  // Try several handlers safely; each returns a reply string or null.
  const RULES = [
    // --- Calculator (offline) ---
    async t => {
      let expr = null;
      let m = t.match(/^(?:calculate|compute|what(?:'?s| is)|how much is|solve)\s+(.+)$/i);
      if (m && /[\d).]\s*[-+*/x×÷%^]|\bof\b|sqrt|sin|cos|tan|\bpi\b/i.test(m[1])) expr = m[1];
      else if (/^[\d.()\s]*\d[\d.()\s]*[-+*/x×÷%^][\d.()\s%]*$/.test(t) || /\d\s*%\s*of\s*\d/i.test(t)) expr = t;
      if (!expr || typeof evaluateMath !== "function") return null;
      try { const r = evaluateMath(expr); return `${expr.replace(/\s+/g, " ").trim()} is ${r}, ${A()}.`; } catch { return null; }
    },
    // --- Unit conversion (offline) ---
    async t => {
      const m = t.match(/\bconvert\s+(-?\d+(?:\.\d+)?)\s*([a-z°/²]+)\s+(?:to|into|in)\s+([a-z°/²]+)/i)
        || t.match(/\b(-?\d+(?:\.\d+)?)\s*([a-z°/²]+)\s+(?:to|in|into)\s+([a-z°/²]+)\b/i);
      if (!m || typeof convertUnits !== "function") return null;
      try { const r = convertUnits({ value: Number(m[1]), from: m[2], to: m[3] }); return `${r.value} ${m[2]} is ${r.result} ${m[3]}, ${A()}.`; }
      catch (e) { return e.message; }
    },
    // --- Coin / dice / pick / random number (offline) ---
    async t => {
      if (typeof decide !== "function") return null;
      if (/\bflip a coin\b|\btoss a coin\b/i.test(t)) return `${decide({ mode: "coin" }).result}, ${A()}.`;
      let m = t.match(/\broll(?:\s+a)?\s+(?:dice|die|d(\d+))\b/i);
      if (m) { const r = decide({ mode: "dice", sides: m[1] ? Number(m[1]) : 6 }); return `A ${r.result}, ${A()}.`; }
      m = t.match(/\brandom number(?:\s+between\s+(\d+)\s+and\s+(\d+))?/i);
      if (m) { const r = decide({ mode: "number", min: m[1], max: m[2] }); return `${r.result}, ${A()}.`; }
      m = t.match(/\b(?:pick|choose|decide)\b.*?\b(?:between|from|among)?\s+(.+)/i);
      if (m && /,|\bor\b/.test(m[1])) { const opts = m[1].replace(/^(?:between|from|among|of)\s+/i, ""); const r = decide({ options: opts }); return `${r.chose}, ${A()}.`; }
      return null;
    },
    // --- Password (offline) ---
    async t => {
      if (typeof generatePassword !== "function") return null;
      if (/\bpass ?phrase\b/i.test(t)) { const r = generatePassword({ words: (num(t) || 4) }); copyQuietly(r.password); return `Here you are, ${A()}: ${r.password}. Copied.`; }
      if (/\b(generate|make|create|give me|new)\b.*\bpassword\b/i.test(t)) { const n = num(t); const r = generatePassword({ length: n || 16 }); copyQuietly(r.password); return `${r.password} — copied, ${A()}.`; }
      return null;
    },
    // --- Tasbeeh & azkar (offline) ---
    async t => {
      if (typeof tasbeeh === "function" && /^(tasbeeh|tasbih|subhan ?allah|سبحان الله|alhamdulillah|allahu? akbar)\b/i.test(t)) {
        const phrase = /alhamd/i.test(t) ? "alhamdulillah" : /akbar/i.test(t) ? "allahuakbar" : "subhanallah";
        const r = tasbeeh({ phrase }); return `${r.count}${r.reached ? ` — that's ${r.reached}, ${A()}.` : "."}`;
      }
      if (typeof azkar === "function" && /\bazkar|adhkar|أذكار|اذكار\b/i.test(t)) {
        const r = azkar({ time: /even|night|مسا/i.test(t) ? "evening" : /morn|صبا/i.test(t) ? "morning" : "" });
        const first = r.azkar[0]; return `${r.time} azkar, ${A()}. ${first.ar} — ${first.en}`;
      }
      return null;
    },
    // --- Date / days until (offline) ---
    async t => {
      if (typeof dateCalc !== "function") return null;
      const m = t.match(/\bhow many days (?:until|till|to)\s+(.+)/i) || t.match(/\bwhat day (?:is|was)\s+(.+)/i);
      if (!m) return null;
      try {
        const r = dateCalc({ date: m[1].replace(/[?.]$/, "").trim() });
        if (/what day/i.test(t)) return `${r.date} is a ${r.weekday}, ${A()}.`;
        return `${r.direction === "today" ? "That's today" : r.direction}, ${A()}. (${r.date})`;
      } catch { return null; }
    },
    // --- Ringer mode (offline) ---
    async t => {
      if (typeof setRinger !== "function") return null;
      const m = t.match(/\b(vibrate|silent|normal)\b/i);
      if (!m || !/\b(ringer|ring mode|phone on|sound|put .* on)\b/i.test(t)) return null;
      try { await setRinger({ mode: m[1].toLowerCase() }); return `Ringer on ${m[1].toLowerCase()}, ${A()}.`; }
      catch (e) { return e.message; }
    },
    // --- Brightness (offline) ---
    async t => {
      if (typeof setScreenBrightness !== "function") return null;
      if (/\bauto(?:matic)? brightness\b/i.test(t)) { try { await setScreenBrightness({ auto: true }); return `Brightness on automatic, ${A()}.`; } catch (e) { return e.message; } }
      const m = t.match(/\bbrightness\s+(?:to\s+)?(\d{1,3})\b/i) || (/\b(dim|darken)\b.*\bscreen\b|\bdim the screen\b/i.test(t) ? ["", "25"] : /\bbrighten\b.*\bscreen\b|\bscreen brighter\b/i.test(t) ? ["", "90"] : null);
      if (!m) return null;
      try { await setScreenBrightness({ percent: Number(m[1]) }); return `Brightness at ${m[1]}%, ${A()}.`; }
      catch (e) { return e.message; }
    },
    // --- Media controls (offline) ---
    async t => {
      const map = [[/\b(pause|stop)\b.*\b(music|song|playback|track)\b|^pause$|^stop$/i, "pause"], [/\b(resume|play)\b.*\b(music|song)\b|^play$|^resume$/i, "play"], [/\b(next|skip)\b.*\b(song|track)\b|^next$|^skip$/i, "next"], [/\b(previous|last|back)\b.*\b(song|track)\b|^previous$/i, "previous"]];
      for (const [re, action] of map) {
        if (re.test(t)) { try { await DeviceActions.mediaControl({ action }); return `${action === "next" ? "Next track" : action === "previous" ? "Previous track" : action === "pause" ? "Paused" : "Playing"}, ${A()}.`; } catch (e) { return e.message; } }
      }
      return null;
    },
    // --- Run a protocol (offline, if its steps are offline-capable) ---
    async t => {
      if (typeof runProtocol !== "function") return null;
      const m = t.match(/\b(?:run|engage|activate|start)\s+(?:the\s+)?(.+?)(?:\s+protocol)?$/i);
      if (!m) return null;
      const key = m[1].toLowerCase().trim();
      if (!(state.actionProtocols || []).some(p => p.key === key || p.key.includes(key)) && !/night|morning/.test(key)) return null;
      try { const r = await runProtocol({ name: key }); return `${r.ran} engaged, ${A()}.`; }
      catch { return null; }
    },
    // --- Call / text a contact (offline — SIM & contacts are local) ---
    async t => {
      if (typeof textContact !== "function") return null;
      let m = t.match(/^(?:text|message|sms|whatsapp|wa)\s+(.+?)\s+(?:saying|that|:)\s+(.+)$/i)
        || t.match(/^(?:tell|let)\s+(.+?)\s+(?:know\s+)?(?:that\s+)?(.+)$/i);
      if (m) { try { const r = await textContact(m[1].trim(), m[2].trim()); return r.texted ? `Sent to ${m[1].trim()}, ${A()}.` : `Ready to send to ${m[1].trim()}, ${A()}.`; } catch (e) { return e.message; } }
      m = t.match(/^(?:call|ring|phone|dial)\s+(.+)$/i);
      if (m && !/^[\d\s+()\-]+$/.test(m[1])) { try { const r = await callContact(m[1].trim()); return r.called ? `Calling ${m[1].trim()}, ${A()}.` : `Dialing ${m[1].trim()}, ${A()}.`; } catch (e) { return e.message; } }
      return null;
    },
    // --- Navigate (offline launch; routing may need data) ---
    async t => {
      const m = t.match(/\b(?:take me to|navigate to|directions to|drive to|go to)\s+(.+)/i) || (/\btake me home\b/i.test(t) ? ["", "home"] : null);
      if (!m) return null;
      let dest = m[1].replace(/[?.]$/, "").trim();
      const key = dest.toLowerCase();
      if (key === "home") dest = (state.places && state.places.home ? `${state.places.home.lat},${state.places.home.lon}` : state.homeLoc) || dest;
      else if (key === "work") dest = (state.places && state.places.work ? `${state.places.work.lat},${state.places.work.lon}` : state.workLoc) || dest;
      if (!dest) return `I don't have your ${key} saved, ${A()}. Set it in Settings.`;
      try { await DeviceActions.navigate({ destination: dest, mode: "driving" }); return `Navigating to ${m[1].trim()}, ${A()}.`; } catch (e) { return `I couldn't start navigation, ${A()}: ${e.message}`; }
    },
    // --- Remember a fact (offline) ---
    async t => {
      if (typeof rememberFact !== "function") return null;
      const m = t.match(/^remember(?:\s+that)?\s+(.+)/i);
      if (!m) return null;
      rememberFact(m[1].trim()); return `Noted and remembered, ${A()}.`;
    },
    // --- Trackers: weight / mood / expense / habit / workout (offline) ---
    async t => {
      let m = t.match(/\bi\s+weigh\s+(\d+(?:\.\d+)?)/i);
      if (m && typeof logWeight === "function") { const r = logWeight({ kg: Number(m[1]) }); return `Logged ${r.latest}, ${A()}.`; }
      m = t.match(/\b(?:feeling|mood(?:\s+is)?)\s+(\d{1,2})(?:\s*(?:out of|\/)\s*10)?\b/i);
      if (m && typeof logMood === "function") { logMood({ score: Number(m[1]), note: t.replace(/.*\b\d{1,2}\b/, "").trim() }); return `Mood ${m[1]} out of 10, logged, ${A()}.`; }
      m = t.match(/\bi\s+(?:spent|paid)\s+(\d+(?:\.\d+)?)\s*\w*\s+(?:on|for)\s+(.+)/i);
      if (m && typeof logExpense === "function") { const r = logExpense({ amount: Number(m[1]), category: m[2].trim(), note: m[2].trim() }); return `Logged ${r.logged.amount} ${r.logged.currency} on ${r.logged.category}, ${A()}.`; }
      m = t.match(/\b(?:i\s+(?:went to|did|finished)\s+(.+)|track\s+(.+))$/i);
      if (m && typeof trackHabit === "function" && /gym|workout|work ?out|exercise|run|read|pray|meditat|walk/i.test(m[1] || m[2] || "")) {
        const habit = (m[1] || m[2]).replace(/\bthe\b/, "").trim(); const r = trackHabit({ habit }); return `${habit} logged — ${r.streakDays} day streak, ${A()}.`;
      }
      m = t.match(/\bi\s+(?:ran|jogged|walked|swam)\s+(\d+(?:\.\d+)?)\s*(?:km|kilometers?)/i);
      if (m && typeof logWorkout === "function") { logWorkout({ type: t.match(/swam/i) ? "swim" : t.match(/walk/i) ? "walk" : "run", distance_km: Number(m[1]) }); return `Logged, ${A()}.`; }
      return null;
    },
    // --- Find a note (offline) ---
    async t => {
      if (typeof findNotes !== "function") return null;
      const m = t.match(/\bfind\s+(?:my\s+)?notes?\s+(?:about\s+|on\s+|for\s+)?(.+)/i) || t.match(/\bwhat(?:'?s| is)\s+my\s+note\s+(?:about\s+)?(.+)/i);
      if (!m) return null;
      const r = findNotes(m[1].replace(/[?.]$/, "").trim());
      if (!r.notes.length) return `I don't have a note on that, ${A()}.`;
      return `${r.notes[0].text}${r.notes.length > 1 ? ` (and ${r.notes.length - 1} more)` : ""}.`;
    },
    // --- Timer (offline, chimes while app open) ---
    async t => {
      if (typeof timerTool !== "function") return null;
      const m = t.match(/\b(?:set a |start a )?timer\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(min|minute|hour|second|sec)/i)
        || t.match(/\b(\d+(?:\.\d+)?)\s*(min|minute|hour)\b.*\btimer\b/i);
      if (!m) return null;
      let mins = Number(m[1]); if (/hour/i.test(m[2])) mins *= 60; else if (/sec/i.test(m[2])) mins /= 60;
      const r = timerTool({ minutes: mins }); return `Timer set for ${m[1]} ${m[2]}${/s$/.test(m[2]) ? "" : "s"}, ${A()} — rings at ${r.ringsAt}.`;
    },
    // --- World clock (offline) ---
    async t => {
      if (typeof worldClock !== "function") return null;
      const m = t.match(/\b(?:what(?:'?s| is) the )?time (?:is it )?in\s+(.+)/i);
      if (!m) return null;
      try { const r = worldClock({ city: m[1].replace(/[?.]$/, "").trim() }); return `It's ${r.localTime} in ${r.city}, ${A()}.`; }
      catch (e) { return e.message; }
    },
    // --- Tip / split a bill (offline) ---
    async t => {
      if (typeof tipCalc !== "function") return null;
      const m = t.match(/\b(?:tip|split).*?(\d+(?:\.\d+)?)/i);
      if (!m || !/\b(tip|split|bill)\b/i.test(t)) return null;
      const pct = (t.match(/(\d+)\s*%/) || [])[1];
      const ppl = (t.match(/\b(?:between|among|for)\s+(\d+)\b/i) || [])[1];
      try { const r = tipCalc({ amount: Number(m[1]), tip_percent: pct, split: ppl }); return r.perPerson ? `${r.total} total with ${r.tipPercent}% tip — ${r.perPerson} each, ${A()}.` : `${r.total} total with a ${r.tip} tip (${r.tipPercent}%), ${A()}.`; }
      catch (e) { return e.message; }
    },
    // --- Zakat (offline) ---
    async t => {
      if (typeof zakatCalc !== "function") return null;
      const m = t.match(/\bzakat\b.*?(\d[\d,]*(?:\.\d+)?)/i) || (/زكاة/.test(t) ? t.match(/(\d[\d,]*(?:\.\d+)?)/) : null);
      if (!m) return null;
      const r = zakatCalc({ savings: Number(m[1].replace(/,/g, "")) }); return `Zakat on ${r.netWealth} is ${r.zakatDue}, ${A()} (2.5%).`;
    },
    // --- Add to a list (offline) ---
    async t => {
      if (typeof listAdd !== "function") return null;
      const m = t.match(/\badd\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(.+?)\s+list\b/i);
      if (!m) return null;
      try { const r = listAdd({ list: m[2].trim(), items: m[1].trim() }); return `Added ${r.added.join(", ")} to your ${r.list} list, ${A()} (${r.total} item${r.total === 1 ? "" : "s"}).`; }
      catch (e) { return e.message; }
    },
    // --- Age from a birthdate (offline) ---
    async t => {
      if (typeof ageCalc !== "function") return null;
      const m = t.match(/\b(?:how old.*born|age.*born|born on|my age if.*born)\D*(\d{4}-\d{1,2}-\d{1,2})/i);
      if (!m) return null;
      try { const r = ageCalc({ birthdate: m[1] }); return `You'd be ${r.years}, ${A()} — ${r.age}. Next birthday in ${r.nextBirthdayInDays} days.`; }
      catch (e) { return e.message; }
    },
    // --- List reminders (offline) ---
    async t => {
      if (!/\b(?:my|list|show|what are|any)\s+reminders?\b|\bwhat(?:'?s| is) on my list\b/i.test(t)) return null;
      const open = (state.reminders || []).filter(r => !r.done);
      if (!open.length) return `No reminders, ${A()}. All clear.`;
      const soon = open.slice(0, 5).map(r => r.text + (r.time ? ` (${fmtWhen(r.time)})` : "")).join("; ");
      return `${open.length} reminder${open.length === 1 ? "" : "s"}, ${A()}: ${soon}.`;
    },
  ];

  async function copyQuietly(text) { try { await Clipboard.write({ string: text }); } catch {} }

  // Wrap the existing offline parser: try the new rules first, then the old one.
  const prevLocal = typeof tryLocalCommand === "function" ? tryLocalCommand : async () => null;
  tryLocalCommand = async function (raw) {
    const t = String(raw || "").trim().replace(/^(?:ok |okay |hey )?jarvis[,\s]+/i, "").replace(/[.!]+$/, "");
    for (const rule of RULES) {
      let reply = null;
      try { reply = await rule(t); } catch (e) { reply = null; }
      if (reply) { if (typeof logActivity === "function" && /^(Calling|Sent|Logged|Navigating|Ringer|Brightness|Paused|Playing|Timer|Added|Zakat|engaged)/.test(reply)) logActivity("OFFLINE: " + reply.slice(0, 40)); return reply; }
    }
    return prevLocal(raw);
  };
})();

async function initOffline() { /* nothing to load; the wrap applied at load time */ }
