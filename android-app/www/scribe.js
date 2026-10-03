/* ======================================================================
 * Jarvis 3.5 — the Scribe pack
 *
 * A writing secretary: rewrite/fix messages (English or Arabic), draft
 * replies and emails, brainstorm, suggest recipes (and fill the shopping
 * list), and keep a read-it-later list. Content-only. Loads after knowledge.js.
 * ====================================================================== */

Object.assign(state, { readingList: [] });

async function askModel(system, user, max) {
  const data = await callGroq([
    { role: "system", content: system },
    { role: "user", content: String(user).slice(0, max || 8000) },
  ], { withTools: false, model: "openai/gpt-oss-20b" });
  return collapseRepeats((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "");
}

/* 1. Rewrite / fix text --------------------------------------------------------- */
const STYLES = {
  fix: "Fix spelling, grammar and punctuation. Keep the meaning and the writer's voice; change as little as possible.",
  formal: "Rewrite it in polished, professional language.",
  casual: "Rewrite it in a relaxed, friendly tone.",
  polite: "Rewrite it to sound warm and polite.",
  shorter: "Make it clearly shorter and tighter, same meaning.",
  longer: "Expand it a little with helpful detail, same meaning.",
  confident: "Rewrite it to sound confident and direct.",
};
async function rewriteText({ text, style } = {}) {
  const body = String(text || "").trim();
  if (!body) throw new Error("What should I rewrite?");
  const s = STYLES[String(style || "fix").toLowerCase()] || STYLES.fix;
  const out = await askModel(`You are an editor. ${s} Reply in the same language as the input. Output only the rewritten text, nothing else.`, body);
  if (!out) throw new Error("That came back empty.");
  return { style: style || "fix", original: body, rewritten: out };
}

/* 2. Draft a reply or a new message --------------------------------------------- */
async function draftMessage({ about, replying_to, kind, tone, language } = {}) {
  const brief = String(about || "").trim();
  if (!brief && !replying_to) throw new Error("Tell me what to say, or what you're replying to.");
  const k = /mail/.test(kind || "") ? "email" : /whats|wa/.test(kind || "") ? "WhatsApp message" : /sms|text/.test(kind || "") ? "text message" : "message";
  const parts = [`Draft a ${k}${tone ? " in a " + tone + " tone" : ""}.`];
  if (replying_to) parts.push(`You are replying to this message:\n"${String(replying_to).slice(0, 1500)}"`);
  if (brief) parts.push(`What the user wants to say: ${brief}`);
  if (language) parts.push(`Write it in ${language}.`);
  parts.push(k === "email" ? "Give a Subject: line, then the body." : "Just the message text, ready to send. Keep it natural.");
  const out = await askModel("You write clear, natural messages on the user's behalf. Output only the draft.", parts.join("\n"));
  return { kind: k, draft: out, note: "Offer to send it (email/WhatsApp/text) or copy it; adjust if they want changes." };
}

/* 3. Brainstorm ----------------------------------------------------------------- */
async function brainstorm({ topic, count } = {}) {
  const t = String(topic || "").trim();
  if (!t) throw new Error("Brainstorm about what?");
  const n = clampNum(count, 3, 12, 6);
  const out = await askModel(`Give ${n} short, concrete, varied ideas about the user's topic. One per line, no numbering, no preamble.`, t);
  const ideas = out.split("\n").map(l => l.replace(/^[\s\-*•\d.]+/, "").trim()).filter(Boolean).slice(0, n);
  return { topic: t, ideas };
}

/* 4. Recipe --------------------------------------------------------------------- */
async function suggestRecipe({ dish, ingredients, add_to_list } = {}) {
  const have = String(ingredients || "").trim();
  const d = String(dish || "").trim();
  if (!d && !have) throw new Error("A dish you want, or some ingredients you have?");
  const ask = d ? `A simple recipe for: ${d}.` : `A simple dish I can make with: ${have}.`;
  const out = await askModel(
    "You are a practical home cook (Egyptian kitchen friendly). Reply as JSON only: {\"name\":\"...\",\"ingredients\":[\"...\"],\"steps\":[\"...\"],\"minutes\":30}. Keep ingredients to common items and steps to 4-7 short lines.",
    ask);
  let recipe;
  try { const m = out.match(/\{[\s\S]*\}/); recipe = JSON.parse(m ? m[0] : out); }
  catch { return { recipe: out, note: "Couldn't structure it; read it as is." }; }
  const result = { name: recipe.name, minutes: recipe.minutes, ingredients: recipe.ingredients, steps: recipe.steps };
  if (add_to_list && Array.isArray(recipe.ingredients) && typeof addToList === "function") {
    try { addToList("shopping", recipe.ingredients); result.addedToShopping = recipe.ingredients.length; } catch {}
  } else if (Array.isArray(recipe.ingredients)) {
    result.note = "Offer to add the ingredients to the shopping list.";
  }
  return result;
}

/* 5. Read-it-later list --------------------------------------------------------- */
async function saveToRead({ url, title } = {}) {
  let link = String(url || "").trim();
  if (!link) { try { const c = await Clipboard.read(); const m = String(c.value || "").match(/https?:\/\/\S+/); link = m ? m[0] : ""; } catch {} }
  const label = String(title || "").trim();
  if (!link && !label) throw new Error("Give me a link (or copy one first).");
  state.readingList.unshift({ id: makeId(), url: link, title: label || link, at: new Date().toISOString() });
  state.readingList = state.readingList.slice(0, 200);
  store.set("readingList", state.readingList);
  return { saved: label || link, total: state.readingList.length };
}
function readingList({ remove } = {}) {
  if (remove) {
    const q = String(remove).toLowerCase();
    const before = state.readingList.length;
    state.readingList = state.readingList.filter(r => !(r.id === remove || (r.title || "").toLowerCase().includes(q) || (r.url || "").toLowerCase().includes(q)));
    store.set("readingList", state.readingList);
    return { removed: before - state.readingList.length, remaining: state.readingList.length };
  }
  return { items: state.readingList.slice(0, 20).map(r => ({ title: r.title, url: r.url, saved: fmtWhen(r.at) })), total: state.readingList.length };
}

/* Tools ------------------------------------------------------------------------- */
FEATURE_TOOLS.push(
  xfn("rewrite_text", "Rewrite or fix a piece of text (English or Arabic): fix grammar, or change the tone.", { text: xs, style: { type: "string", enum: ["fix", "formal", "casual", "polite", "shorter", "longer", "confident"] } }, ["text"]),
  xfn("draft_message", "Draft a message or email for the user — a new one, or a reply to something they received.", { about: xs, replying_to: xs, kind: { type: "string", enum: ["email", "whatsapp", "text", "message"] }, tone: xs, language: xs }),
  xfn("brainstorm", "Brainstorm a short list of ideas on a topic.", { topic: xs, count: { type: "integer" } }, ["topic"]),
  xfn("suggest_recipe", "Suggest a recipe for a dish, or from ingredients the user has; can add the ingredients to the shopping list.", { dish: xs, ingredients: xs, add_to_list: { type: "boolean" } }),
  xfn("save_to_read", "Save a link (or the copied one) to the read-it-later list.", { url: xs, title: xs }),
  xfn("reading_list", "Show the read-it-later list, or remove an item.", { remove: xs }),
);
Object.assign(FEATURE_HANDLERS, {
  rewrite_text: a => rewriteText(a), draft_message: a => draftMessage(a), brainstorm: a => brainstorm(a),
  suggest_recipe: a => suggestRecipe(a), save_to_read: a => saveToRead(a), reading_list: a => readingList(a),
});
Object.assign(FEATURE_LABELS, {
  rewrite_text: a => `REWRITING (${a.style || "fix"})`, draft_message: a => `DRAFTING ${String(a.kind || "message").toUpperCase()}`,
  brainstorm: a => `BRAINSTORMING: ${a.topic || ""}`, suggest_recipe: a => `RECIPE: ${a.dish || "from ingredients"}`,
  save_to_read: () => "SAVED TO READ LATER", reading_list: a => a.remove ? "REMOVED FROM LIST" : "READING LIST",
});
TOOL_GROUPS.scribe = {
  about: "rewriting and fixing text, drafting replies and emails, brainstorming, recipes, read-it-later list",
  tools: ["rewrite_text", "draft_message", "brainstorm", "suggest_recipe", "save_to_read", "reading_list"],
  match: /\b(rewrite|reword|fix (my|this|the)|grammar|make it (formal|polite|shorter|longer|casual)|proofread|draft|write (a|an|me) (message|email|reply|text)|reply to|help me (write|say|reply)|brainstorm|ideas for|give me ideas|recipe|cook|what can i (make|cook)|read later|reading list|save (this|the) (link|article))\b|اكتب|صياغة|وصفة/i,
};

async function initScribe() { state.readingList = await store.get("readingList", []); }
