// XP/levels, streak-freeze balance, and the trickier analytics semantics
// (skip-day streak neutrality, daily-consistency skip exclusion, and the
// cross-habit correlation insight) — checked directly against the domain
// functions with constructed data, not just through the UI, since these are
// the calculations most likely to silently drift as the app evolves.

import { chromium, newTestPage, gotoAppAndSkipOnboarding, finish } from "../helpers.mjs";

const errors = [];
const browser = await chromium.launch();
const { context, page } = await newTestPage(browser, errors);
await gotoAppAndSkipOnboarding(page);

// ---- XP + level progress through the UI ----
await page.evaluate(async () => {
  const { addHabit } = await import("/js/state/store.js");
  await addHabit({
    name: "Read", icon: "📖", identityId: null,
    frequency: { type: "daily" }, timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" }, tags: [],
  });
});
await page.waitForTimeout(200);

await page.click("a[href='#/today']");
await page.waitForTimeout(300);
await page.click("[data-checkin][data-mode='full']");
await page.waitForTimeout(300);

const xp = await page.evaluate(async () => {
  const { getState } = await import("/js/state/store.js");
  const { computeXP } = await import("/js/domain/gamification.js");
  return computeXP(getState().checkins);
});
if (xp !== 10) errors.push(`expected 10 XP after one full completion, got ${xp}`);

await page.click("a[href='#/dashboard']");
await page.waitForTimeout(400);
const levelSub = await page.locator(".level-sub").textContent();
if (!levelSub || !levelSub.includes("10")) errors.push(`level progress bar didn't reflect XP: "${levelSub}"`);

// ---- Freeze token balance derivation (direct) ----
const freezeBalance = await page.evaluate(async () => {
  const { getState } = await import("/js/state/store.js");
  const { freezeTokenBalance } = await import("/js/domain/gamification.js");
  return freezeTokenBalance(getState().checkins);
});
if (freezeBalance !== 0) errors.push(`expected 0 freeze tokens after 1 vote (1 token per 20), got ${freezeBalance}`);

// ---- Skip-day streak neutrality + daily-consistency skip exclusion ----
const skipResult = await page.evaluate(async () => {
  const { addHabit, setCheckIn, saveHabit, getState } = await import("/js/state/store.js");
  const { computeCurrentStreak, computeLongestStreak, dailyConsistency } = await import("/js/domain/analytics.js");

  await addHabit({
    name: "Run", icon: "🏃", identityId: null,
    frequency: { type: "daily" }, timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" }, tags: [],
  });
  let habit = getState().habits.find((h) => h.name === "Run");
  const backdated = new Date();
  backdated.setDate(backdated.getDate() - 10);
  await saveHabit({ ...habit, createdAt: backdated.toISOString() });
  habit = getState().habits.find((h) => h.id === habit.id);

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // 4 votes with 1 excused (skipped) gap in the middle — streak should
  // treat the gap as neutral, giving a streak of 4, not broken at 2.
  await setCheckIn(habit.id, isoDaysAgo(4), "full");
  await setCheckIn(habit.id, isoDaysAgo(3), "full");
  await setCheckIn(habit.id, isoDaysAgo(2), "skip");
  await setCheckIn(habit.id, isoDaysAgo(1), "full");
  await setCheckIn(habit.id, isoDaysAgo(0), "full");

  const finalHabit = getState().habits.find((h) => h.id === habit.id);
  const checkins = getState().checkins.filter((c) => c.habitId === habit.id);
  const currentStreak = computeCurrentStreak(finalHabit, checkins);
  const longestStreak = computeLongestStreak(finalHabit, checkins);

  // The skipped day should also be excluded from the day's due/done ratio,
  // not counted as a miss. Scoped to just this habit — other habits added
  // earlier in this same spec (e.g. "Read") are also due/done today and
  // would otherwise pollute the ratio.
  await setCheckIn(habit.id, isoDaysAgo(0), "skip");
  const cell = dailyConsistency([finalHabit], getState().checkins, [isoDaysAgo(0)])[0];

  return { currentStreak, longestStreak, cell };
});
if (skipResult.currentStreak !== 4) errors.push(`skip-neutral currentStreak expected 4, got ${skipResult.currentStreak}`);
if (skipResult.longestStreak !== 4) errors.push(`skip-neutral longestStreak expected 4, got ${skipResult.longestStreak}`);
if (skipResult.cell.due !== 0 || skipResult.cell.done !== 0) {
  errors.push(`skipped day should be excluded from due/done, got due=${skipResult.cell.due} done=${skipResult.cell.done}`);
}

// ---- Correlation insight against a constructed dataset with a known relationship ----
const correlation = await page.evaluate(async () => {
  const { addHabit, setCheckIn, saveHabit, getState } = await import("/js/state/store.js");
  const { computeCorrelationInsight, computeCorrelationInsights } = await import("/js/domain/insights.js");

  for (const name of ["Meditate", "Journal", "Unrelated", "Stretch", "Plan"]) {
    const icon = { Meditate: "🧘", Journal: "✍️", Unrelated: "🤸", Stretch: "🤾", Plan: "🗒️" }[name];
    await addHabit({
      name, icon, identityId: null,
      frequency: { type: "daily" }, timeOfDay: "anytime",
      cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
      stackAnchor: { type: "none" }, tags: [],
    });
  }

  let habits = getState().habits;
  const backdated = new Date();
  backdated.setDate(backdated.getDate() - 40);
  for (const h of habits.filter((h) => ["Meditate", "Journal", "Unrelated", "Stretch", "Plan"].includes(h.name))) {
    await saveHabit({ ...h, createdAt: backdated.toISOString() });
  }
  habits = getState().habits;
  const meditate = habits.find((h) => h.name === "Meditate");
  const journal = habits.find((h) => h.name === "Journal");
  const unrelated = habits.find((h) => h.name === "Unrelated");
  const stretch = habits.find((h) => h.name === "Stretch");
  const plan = habits.find((h) => h.name === "Plan");

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  for (let i = 1; i <= 30; i++) {
    const date = isoDaysAgo(i);
    const meditateDone = i % 2 === 0;
    await setCheckIn(meditate.id, date, meditateDone ? "full" : "clear");
    const journalDone = meditateDone || i === 3;
    await setCheckIn(journal.id, date, journalDone ? "full" : "clear");
    await setCheckIn(unrelated.id, date, i % 3 === 0 ? "full" : "clear");
    // A second, independent relationship (odd days instead of even, with a
    // couple more noise days than Meditate/Journal so it stays the weaker
    // signal) — gives the multi-insight query two distinct qualifying pairs.
    const stretchDone = i % 2 === 1;
    await setCheckIn(stretch.id, date, stretchDone ? "full" : "clear");
    const planDone = stretchDone || i === 6 || i === 12;
    await setCheckIn(plan.id, date, planDone ? "full" : "clear");
  }

  const insight = computeCorrelationInsight(getState().habits, getState().checkins);
  const insights = computeCorrelationInsights(getState().habits, getState().checkins, 3);
  return {
    single: insight ? { a: insight.a.name, b: insight.b.name, withRate: insight.withRate, withoutRate: insight.withoutRate } : null,
    multi: insights.map((c) => ({ a: c.a.name, b: c.b.name })),
  };
});
if (!correlation.single || correlation.single.a !== "Meditate" || correlation.single.b !== "Journal") {
  errors.push(`correlation insight didn't find the expected Meditate->Journal relationship: ${JSON.stringify(correlation.single)}`);
} else if (correlation.single.withRate < 0.9 || correlation.single.withoutRate > 0.2) {
  errors.push(`correlation insight rates out of expected range: ${JSON.stringify(correlation.single)}`);
}
if (correlation.multi.length < 2) {
  errors.push(`expected at least 2 correlation insights from the two constructed relationships, got: ${JSON.stringify(correlation.multi)}`);
}
const hasMeditateJournal = correlation.multi.some((c) => c.a === "Meditate" && c.b === "Journal");
const hasStretchPlan = correlation.multi.some((c) => c.a === "Stretch" && c.b === "Plan");
if (!hasMeditateJournal || !hasStretchPlan) {
  errors.push(`expected both Meditate->Journal and Stretch->Plan among multi-insights, got: ${JSON.stringify(correlation.multi)}`);
}
const pairKeys = correlation.multi.map((c) => [c.a, c.b].sort().join(":"));
if (new Set(pairKeys).size !== pairKeys.length) {
  errors.push(`multi-insights contains a duplicate pair: ${JSON.stringify(correlation.multi)}`);
}

await context.close();
await browser.close();
finish("gamification.spec", errors);
