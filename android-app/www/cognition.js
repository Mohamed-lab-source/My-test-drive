/* ======================================================================
 * Jarvis 3.8 — the Cognition pack (the brain)
 *
 * The parts that make Jarvis feel like the real thing: he keeps a working
 * understanding of your world and reasons over it. This adds —
 *   • awareness   : live, locally-computed insights injected into every
 *                   answer, so he always knows what's going on with you;
 *   • anticipation: a proactive scan that surfaces what matters, unasked;
 *   • reasoning   : a deep-think mode that escalates to harder thinking;
 *   • planning    : turns a goal into ordered, actionable steps;
 *   • reflection  : a self-written digest of how your week/life is going;
 *   • learning    : quietly distils durable facts about you into memory.
 *
 * Loads after toolsmith.js. The insight engine is pure-offline and never
 * throws; the reasoning/planning/reflection tools use the model.
 * ====================================================================== */

Object.assign(state, { lifeDigest: "", lifeDigestAt: 0 });

const CG_ADDR = () => state.address || "sir";
const cgHour = () => new Date().getHours();
const cgDaysSince = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;

/* ----------------------------------------------------------------------
 * The insight engine — reads only local, on-device data and returns a
 * prioritised list of things worth knowing. Every rule is guarded; this
 * must never throw, so it can run on every turn and on launch.
 * -------------------------------------------------------------------- */
function insightScan() {
  const out = [];
  const push = (level, text) => { if (text) out.push({ level, text }); };
  const rule = fn => { try { fn(); } catch {} };
  const today = typeof localDayKey === "function" ? localDayKey() : "";
  const evening = cgHour() >= 17;

  // Battery — only the genuinely urgent end (greet handles the chatty case).
  rule(() => {
    if (typeof telemetry === "object" && telemetry.battery >= 0 && telemetry.battery <= 10 && !telemetry.charging)
      push(3, `Battery is at ${telemetry.battery}% and not charging — worth plugging in.`);
  });

  // Overdue reminders (have a time, it's passed, not done).
  rule(() => {
    const overdue = (state.reminders || []).filter(r => !r.done && r.time && new Date(r.time) < new Date());
    if (overdue.length) push(3, `${overdue.length} reminder${overdue.length === 1 ? "" : "s"} overdue, oldest: "${overdue[0].text}".`);
  });

  // Bills due within five days and not yet paid this cycle.
  rule(() => {
    if (typeof T !== "object" || !T.bills || typeof nextDue !== "function") return;
    const now = new Date();
    T.bills.forEach(b => {
      const d = nextDue(b, now); const days = Math.round((d - now) / 86400000);
      if (days >= 0 && days <= 5) push(days <= 1 ? 3 : 2, `${b.name} (${money(b.amount, b.currency)}) is due ${days <= 0 ? "today" : days === 1 ? "tomorrow" : "in " + days + " days"}.`);
    });
  });

  // Birthdays / important dates within a week.
  rule(() => {
    if (!state.importantDates || typeof describeDate !== "function") return;
    state.importantDates.map(describeDate).filter(d => d.daysUntil >= 0 && d.daysUntil <= 7).sort((a, b) => a.daysUntil - b.daysUntil)
      .forEach(d => push(d.daysUntil <= 1 ? 3 : 2, `${d.label}${d.turning ? " (turning " + d.turning + ")" : ""} ${d.daysUntil === 0 ? "is today" : d.daysUntil === 1 ? "is tomorrow" : "is in " + d.daysUntil + " days"} (${d.date}).`));
  });

  // Habit streaks at risk — a live streak, not done today, and it's evening.
  rule(() => {
    if (!state.habits || typeof habitStats !== "function") return;
    const yesterday = typeof localDayKey === "function" ? localDayKey(new Date(Date.now() - 86400000)) : "";
    Object.keys(state.habits).forEach(k => {
      const s = habitStats(k);
      if (evening && !s.doneToday && s.streakDays >= 2 && s.lastDone === yesterday)
        push(2, `Your ${k} streak (${s.streakDays} days) is still open today — don't break it.`);
    });
  });

  // Weight: tracking a goal but gone quiet for a week+.
  rule(() => {
    if (typeof T !== "object" || !T.weight || !T.weight.length || !T.weightGoal) return;
    const days = cgDaysSince(T.weight[T.weight.length - 1].at);
    if (days >= 7) push(1, `No weigh-in for ${days} days — a quick one keeps the trend honest.`);
  });

  // Mood running low across the last week.
  rule(() => {
    if (typeof T !== "object" || !T.mood) return;
    const wk = T.mood.filter(m => new Date(m.at) >= since(7));
    if (wk.length >= 3) { const avg = wk.reduce((s, m) => s + m.score, 0) / wk.length; if (avg < 4) push(2, `Your mood's averaged ${avg.toFixed(1)}/10 this week — be kind to yourself.`); }
  });

  // Water behind target late in the day.
  rule(() => {
    if (typeof T !== "object" || !T.water) return;
    const had = T.water.days[today] || 0;
    if (cgHour() >= 16 && T.water.goal && had < T.water.goal - 2) push(1, `Water's at ${had} of ${T.water.goal} glasses — a few more before the day's out.`);
  });

  // Unsettled debts.
  rule(() => {
    if (typeof T !== "object" || !T.debts) return;
    const owedToMe = T.debts.filter(d => !d.settled && d.direction === "owes_me");
    if (owedToMe.length) push(1, `${owedToMe.length} unsettled debt${owedToMe.length === 1 ? "" : "s"} owed to you.`);
  });

  // He barely knows you yet — invite him to learn.
  rule(() => {
    if ((state.memories || []).length < 3) push(1, `I barely know you yet — tell me a few things to remember and I'll keep them.`);
  });

  return out.sort((a, b) => b.level - a.level);
}

/* ----------------------------------------------------------------------
 * Injected into every system prompt: the self-written life digest plus
 * the top live insights, so Jarvis answers with real awareness and
 * raises what matters on his own.
 * -------------------------------------------------------------------- */
function cognitionPromptLines() {
  const out = [];
  if (state.lifeDigest) out.push(`Your read on the user (from reflection): ${state.lifeDigest}`);
  const top = insightScan().slice(0, 4);
  if (top.length) {
    out.push("Things you've noticed (raise any that fit the moment, naturally, at most one or two — never dump the list):");
    top.forEach(i => out.push(`- ${i.text}`));
  }
  return out;
}

/* ----------------------------------------------------------------------
 * Tool 1 — proactive check: "anything I should know?"
 * -------------------------------------------------------------------- */
function proactiveCheck() {
  const items = insightScan();
  if (!items.length) return { clear: true, note: "Nothing pressing — tell them all's quiet and in order." };
  return { items: items.slice(0, 5).map(i => i.text), note: "Relay the important ones in character, briefly. Lead with the most urgent." };
}

/* ----------------------------------------------------------------------
 * Tool 2 — deep think: escalate to harder reasoning for a real question.
 * -------------------------------------------------------------------- */
async function deepThink({ question, context } = {}) {
  const q = String(question || "").trim();
  if (!q) throw new Error("What should I think about?");
  const sys = "You are J.A.R.V.I.S., reasoning carefully for the person you serve. Think the problem through rigorously, weigh the options, and then give a clear, decisive conclusion in a few tight sentences. No markdown headers, no bullet dumps — speak it plainly.";
  const data = await callGroq(
    [{ role: "system", content: sys }, { role: "user", content: context ? `${q}\n\nWhat I know:\n${String(context).slice(0, 4000)}` : q }],
    { withTools: false, model: "openai/gpt-oss-120b", reasoningEffort: "high", maxTokens: 2048 }
  );
  const answer = collapseRepeats((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "");
  if (!answer) throw new Error("I couldn't reach a conclusion on that.");
  return { answer, note: "This is your considered view — deliver it in character." };
}

/* ----------------------------------------------------------------------
 * Tool 3 — plan: turn a goal into ordered, concrete steps.
 * -------------------------------------------------------------------- */
async function makePlan({ goal, set_reminders } = {}) {
  const g = String(goal || "").trim();
  if (!g) throw new Error("A goal to plan for?");
  const nowIso = typeof localIsoNoZone === "function" ? localIsoNoZone(new Date()) : new Date().toISOString();
  const data = await callGroq([
    { role: "system", content: `You are a sharp planner. Break the user's goal into 3–7 concrete, ordered steps they can actually do. Reply as JSON only: {"steps":[{"step":"...","when":"ISO datetime with no timezone (YYYY-MM-DDTHH:MM) if the step has a natural deadline, else null"}],"firstMove":"the single thing to do right now"}. Right now it is ${nowIso}.` },
    { role: "user", content: g },
  ], { withTools: false, model: "openai/gpt-oss-120b", reasoningEffort: "high", maxTokens: 1500 });
  const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  let plan;
  try { const m = raw.match(/\{[\s\S]*\}/); plan = JSON.parse(m ? m[0] : raw); } catch { return { plan: raw, note: "Read it out as the plan." }; }
  const result = { goal: g, firstMove: plan.firstMove, steps: (plan.steps || []).map(s => s.step) };
  if (set_reminders && typeof addReminder === "function") {
    const made = [];
    for (const s of (plan.steps || [])) {
      if (s.when && !isNaN(new Date(s.when))) {
        try { await addReminder(s.step, s.when); made.push(s.step); } catch {}
      }
    }
    if (made.length) result.remindersSet = made;
  } else if ((plan.steps || []).some(s => s.when)) {
    result.note = "Some steps have times — offer to set reminders for them.";
  }
  return result;
}

/* ----------------------------------------------------------------------
 * Tool 4 — reflect: a short, honest read on how things are going, written
 * from the local data. Also refreshes the life digest injected above.
 * -------------------------------------------------------------------- */
function cgDataSnapshot() {
  const bits = [];
  try { if (T.weight && T.weight.length) { const l = T.weight[T.weight.length - 1]; bits.push(`Weight ${l.kg}kg${T.weightGoal ? " (goal " + T.weightGoal + ")" : ""}, last logged ${cgDaysSince(l.at)}d ago.`); } } catch {}
  try { const wk = T.mood.filter(m => new Date(m.at) >= since(7)); if (wk.length) bits.push(`Mood avg ${(wk.reduce((s, m) => s + m.score, 0) / wk.length).toFixed(1)}/10 over ${wk.length} logs this week.`); } catch {}
  try { const wk = T.workouts.filter(w => new Date(w.at) >= since(7)); bits.push(`${wk.length} workouts in the last 7 days.`); } catch {}
  try { const hs = Object.keys(state.habits).map(k => { const s = habitStats(k); return `${k} ${s.streakDays}d streak`; }); if (hs.length) bits.push(`Habits: ${hs.join(", ")}.`); } catch {}
  try { const ms = since(30); const tot = {}; state.expenses.filter(e => new Date(e.at) >= ms).forEach(e => tot[e.currency] = (tot[e.currency] || 0) + e.amount); const parts = Object.entries(tot).map(([c, v]) => `${Math.round(v)} ${c}`); if (parts.length) bits.push(`Spent ${parts.join(", ")} in the last 30 days.`); } catch {}
  try { if (state.importantDates.length) { const d = state.importantDates.map(describeDate).filter(x => x.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil)[0]; if (d) bits.push(`Next date: ${d.label} in ${d.daysUntil}d.`); } } catch {}
  try { const open = (state.reminders || []).filter(r => !r.done).length; bits.push(`${open} open reminders.`); } catch {}
  try { if (state.memories.length) bits.push(`Known facts: ${state.memories.slice(-8).map(m => m.text).join("; ")}.`); } catch {}
  return bits.join("\n");
}
async function reflect({ period } = {}) {
  const snap = cgDataSnapshot();
  if (!snap.trim()) throw new Error("There's not enough logged yet for me to reflect on. Give it a few days of use.");
  const span = /month/i.test(period || "") ? "the past month" : /day|today/i.test(period || "") ? "today" : "the past week";
  const data = await callGroq([
    { role: "system", content: `You are J.A.R.V.I.S. reflecting on how the person you serve is doing over ${span}, from their own logged data. Write 2–4 honest, warm, specific sentences: what's going well, what's slipping, one gentle suggestion. No lists, no markdown. The data is private and trusted.` },
    { role: "user", content: snap },
  ], { withTools: false, model: "openai/gpt-oss-20b", reasoningEffort: "low", maxTokens: 700 });
  const reflection = collapseRepeats((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "");
  if (reflection) { state.lifeDigest = reflection.slice(0, 600); state.lifeDigestAt = Date.now(); store.set("lifeDigest", state.lifeDigest); store.set("lifeDigestAt", state.lifeDigestAt); }
  return { reflection, note: "Deliver it in character." };
}

/* ----------------------------------------------------------------------
 * Tool 5 — learn: quietly distil durable facts about the user from the
 * running conversation notes + known facts, and remember the new ones.
 * -------------------------------------------------------------------- */
async function updateProfile() {
  const source = [state.convoSummary || "", ...(state.activityLog || []).slice(0, 20).map(a => a.label)].join("\n").trim();
  if (!source) return { learned: [], note: "Nothing new to learn yet." };
  const known = (state.memories || []).map(m => m.text).join("; ");
  const data = await callGroq([
    { role: "system", content: `From the notes below, extract durable facts worth remembering long-term about the user (people in their life, preferences, routines, important commitments). Output JSON only: {"facts":["...","..."]}. Only lasting facts, not one-off events. Skip anything already known. Max 5. Known already: ${known || "(none)"}.` },
    { role: "user", content: source.slice(0, 4000) },
  ], { withTools: false, model: "openai/gpt-oss-20b", reasoningEffort: "low", maxTokens: 500 });
  const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  let facts = [];
  try { const m = raw.match(/\{[\s\S]*\}/); facts = (JSON.parse(m ? m[0] : raw).facts || []); } catch { facts = []; }
  const learned = [];
  for (const f of facts.slice(0, 5)) { try { const r = rememberFact(f); if (r && !r.duplicate) learned.push(f); } catch {} }
  return { learned, note: learned.length ? "Mention you've noted these, briefly." : "Nothing new worth keeping." };
}

/* ===== Registration ============================================================ */
FEATURE_TOOLS.push(
  xfn("whats_up", "Proactively check what the user should know right now — overdue reminders, bills due, birthdays, streaks at risk, and so on. Use for 'anything I should know?', 'what's on your mind?', 'brief me'.", {}),
  xfn("think", "Reason carefully through a hard question or decision (escalates to deeper thinking). Use for genuine problems, trade-offs, analysis — not quick facts.", { question: xs, context: xs }, ["question"]),
  xfn("plan", "Turn a goal into ordered, concrete steps; can set reminders for timed steps.", { goal: xs, set_reminders: { type: "boolean" } }, ["goal"]),
  xfn("reflect", "A short, honest read on how the user is doing, written from their logged data; also updates Jarvis's understanding of them.", { period: { type: "string", enum: ["today", "week", "month"] } }),
  xfn("update_profile", "Quietly learn durable new facts about the user from recent conversations and remember them.", {}),
);
Object.assign(FEATURE_HANDLERS, {
  whats_up: () => proactiveCheck(),
  think: a => deepThink(a),
  plan: a => makePlan(a),
  reflect: a => reflect(a),
  update_profile: () => updateProfile(),
});
Object.assign(FEATURE_LABELS, {
  whats_up: () => "SCANNING",
  think: () => "THINKING DEEPLY",
  plan: a => `PLANNING: ${String(a.goal || "").slice(0, 30)}`,
  reflect: a => `REFLECTING (${a.period || "week"})`,
  update_profile: () => "LEARNING",
});
TOOL_GROUPS.cognition = {
  about: "proactive awareness, deep reasoning, planning a goal into steps, reflecting on how the user is doing, and learning facts about them",
  tools: ["whats_up", "think", "plan", "reflect", "update_profile"],
  match: /\b(what('?s| is) on your mind|anything (i should know|new|important)|brief me|what('?s| is) up|think (about|through|hard)|reason (about|through)|think carefully|figure out|help me decide|should i|make a plan|plan (my|a|for|out)|how (do|should) i|break (this|it) down|reflect|how am i doing|how('?s| is) my (week|month|life going)|learn about me|what do you know about me)\b/i,
};

async function initCognition() {
  state.lifeDigest = await store.get("lifeDigest", "");
  state.lifeDigestAt = await store.get("lifeDigestAt", 0);
}
