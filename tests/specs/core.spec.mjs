// Core CRUD + wizard + stacking regression: habit/identity creation, the
// cycle-prevention guard in the stacking picker, duplicate, backdating a
// past check-in from the habit-detail heatmap, swipe-to-archive + undo, and
// identity editing. Runs in both color schemes.

import { chromium, newTestPage, gotoAppAndSkipOnboarding, checkOverflow, finish } from "../helpers.mjs";

const errors = [];
const browser = await chromium.launch();

for (const colorScheme of ["light", "dark"]) {
  const { context, page } = await newTestPage(browser, errors, { colorScheme, permissions: ["clipboard-read", "clipboard-write"] });
  await gotoAppAndSkipOnboarding(page);

  await page.evaluate(async () => {
    const { addIdentity } = await import("/js/state/store.js");
    await addIdentity("a healthy person");
  });
  await page.waitForTimeout(200);

  // ---- Add habit "Drink water" ----
  await page.click("a[href='#/habits']");
  await page.waitForTimeout(300);
  await page.click("#open-add-habit");
  await page.waitForTimeout(250);
  await page.click("#template-custom");
  await page.waitForTimeout(250);
  await page.fill("#wizard-name", "Drink water");
  await page.click("#wizard-next"); // name -> when
  await page.waitForTimeout(200);
  await page.click("#wizard-next"); // when -> stick
  await page.waitForTimeout(200);
  await page.click("#wizard-next"); // stick -> review
  await page.waitForTimeout(200);
  await page.click("#wizard-next"); // create
  await page.waitForTimeout(700);
  await checkOverflow(page, errors, `${colorScheme}/after-add-habit`);

  // ---- Add habit "Stretch" stacked after "Drink water" ----
  await page.click("#open-add-habit");
  await page.waitForTimeout(250);
  await page.click("#template-custom");
  await page.waitForTimeout(250);
  await page.fill("#wizard-name", "Stretch");
  await page.click("#wizard-next");
  await page.waitForTimeout(200);
  await page.click("label[for='w-stack-habit']");
  await page.waitForTimeout(150);
  await page.selectOption("#wizard-stack-habit", { index: 0 }).catch(() => {});
  await page.click("#wizard-next");
  await page.waitForTimeout(200);
  await page.click("#wizard-next");
  await page.waitForTimeout(200);
  await page.click("#wizard-next");
  await page.waitForTimeout(700);

  // ---- Cycle prevention: editing "Drink water" to stack after "Stretch" must be blocked ----
  const habitCards = page.locator(".habit-card");
  const count = await habitCards.count();
  for (let i = 0; i < count; i++) {
    const name = await habitCards.nth(i).locator(".habit-name").textContent();
    if (name && name.includes("Drink water")) {
      await habitCards.nth(i).locator("[data-edit]").click();
      break;
    }
  }
  await page.waitForTimeout(250);
  await page.click("#wizard-next"); // name -> when (editing skips template)
  await page.waitForTimeout(250);
  await page.click("label[for='w-stack-habit']");
  await page.waitForTimeout(150);
  const stackSelectVisible = await page.locator("#wizard-stack-habit:not(.hidden)").count();
  const stackEmptyNoteVisible = await page.locator("#wizard-stack-empty:not(.hidden)").count();
  if (!(stackSelectVisible === 0 && stackEmptyNoteVisible > 0)) {
    errors.push(`cycle prevention FAILED (${colorScheme}): select visible=${stackSelectVisible} emptyNote visible=${stackEmptyNoteVisible}`);
  }
  await page.click("#wizard-close");
  await page.waitForTimeout(400);

  // ---- Duplicate habit ----
  await page.locator(".habit-card").first().click();
  await page.waitForTimeout(300);
  await page.click("#detail-duplicate");
  await page.waitForTimeout(300);
  const dupName = await page.locator("#wizard-name").inputValue();
  if (!dupName.includes("copy")) errors.push(`duplicate prefill missing "copy" (${colorScheme}): "${dupName}"`);
  await page.click("#wizard-close");
  await page.waitForTimeout(400);

  // ---- Backdate a past check-in via the habit-detail heatmap ----
  await page.locator(".habit-card").first().click();
  await page.waitForTimeout(300);
  const cells = page.locator(".heat-cell-tappable");
  const cellCount = await cells.count();
  if (cellCount === 0) {
    errors.push(`no tappable heatmap cells (${colorScheme})`);
  } else {
    const target = cells.nth(cellCount - 3);
    const dateAttr = await target.getAttribute("data-date");
    await target.click();
    await page.waitForTimeout(300);
    const voted = await page.evaluate(async (date) => {
      const { getState } = await import("/js/state/store.js");
      const { findCheckIn, isVote } = await import("/js/domain/analytics.js");
      const s = getState();
      const habit = s.habits.find((h) => h.name === "Drink water");
      return isVote(findCheckIn(s.checkins, habit.id, date));
    }, dateAttr);
    if (!voted) errors.push(`backdate toggle didn't register a vote (${colorScheme})`);
  }
  await page.click("#detail-close");
  await page.waitForTimeout(400);
  await checkOverflow(page, errors, `${colorScheme}/habit-detail`);

  // ---- Swipe-to-archive + undo ----
  await page.click("a[href='#/today']");
  await page.waitForTimeout(300);
  const row = page.locator(".today-item.swipe-row").first();
  if (await row.count()) {
    const content = row.locator(".swipe-content");
    const box = await content.boundingBox();
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 110, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const archiveBtn = row.locator(".swipe-action-archive");
    await archiveBtn.click({ force: true });
    await page.waitForTimeout(300);
    const snackbar = page.locator(".snackbar");
    if (!(await snackbar.count())) {
      errors.push(`undo snackbar didn't appear after archive (${colorScheme})`);
    } else {
      await page.click(".snackbar-action");
      await page.waitForTimeout(300);
    }
  }

  // ---- Identity detail: edit statement + why ----
  await page.click("a[href='#/identities']");
  await page.waitForTimeout(300);
  await page.locator(".identity-card-main").first().click();
  await page.waitForTimeout(300);
  await page.click("#identity-edit");
  await page.waitForTimeout(200);
  await page.fill("#identity-edit-input", "a healthy, strong person");
  const whyInput = page.locator("#identity-why-input");
  if (await whyInput.count()) await whyInput.fill("It affects everyone around me.");
  await page.click("#identity-save");
  await page.waitForTimeout(300);
  const heroText = await page.locator(".detail-hero-name").textContent();
  if (!heroText || !heroText.includes("healthy, strong")) {
    errors.push(`identity edit didn't persist (${colorScheme}): "${heroText}"`);
  }
  await page.click("#detail-close");
  await page.waitForTimeout(400);

  console.log(`[${colorScheme}] core spec pass complete`);
  await context.close();
}

// ---- findHabitById: correctness, and the WeakMap cache re-keys on a new array reference ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
  const result = await page.evaluate(async () => {
    const { addHabit, getState } = await import("/js/state/store.js");
    const { findHabitById } = await import("/js/domain/analytics.js");

    await addHabit({
      name: "Meditate", icon: "🧘", identityId: null,
      frequency: { type: "daily" }, timeOfDay: "anytime",
      cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
      stackAnchor: { type: "none" }, tags: [],
    });
    const habitsA = getState().habits;
    const found = findHabitById(habitsA, habitsA[0].id);
    const missing = findHabitById(habitsA, "not-a-real-id");

    await addHabit({
      name: "Journal", icon: "✍️", identityId: null,
      frequency: { type: "daily" }, timeOfDay: "anytime",
      cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
      stackAnchor: { type: "none" }, tags: [],
    });
    const habitsB = getState().habits; // a new array reference after the mutation
    const foundInNewArray = findHabitById(habitsB, habitsA[0].id);
    const foundNewHabit = findHabitById(habitsB, habitsB[1].id);

    return {
      foundName: found?.name,
      missingIsUndefined: missing === undefined,
      arraysDiffer: habitsA !== habitsB,
      foundInNewArrayName: foundInNewArray?.name,
      foundNewHabitName: foundNewHabit?.name,
    };
  });
  if (result.foundName !== "Meditate") errors.push(`findHabitById didn't find the right habit, got "${result.foundName}"`);
  if (!result.missingIsUndefined) errors.push("findHabitById should return undefined for an id that doesn't exist");
  if (!result.arraysDiffer) errors.push("test setup error: expected a new habits array reference after addHabit");
  if (result.foundInNewArrayName !== "Meditate") {
    errors.push(`findHabitById should still find an old id after the array reference changed, got "${result.foundInNewArrayName}"`);
  }
  if (result.foundNewHabitName !== "Journal") {
    errors.push(`findHabitById didn't index the newly-added habit in the new array, got "${result.foundNewHabitName}"`);
  }
  await context.close();
}

// ---- batch(): coalesces N mutations' notify() calls into one ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
  const counts = await page.evaluate(async () => {
    const { addHabit, archiveHabit, getState, subscribe, batch } = await import("/js/state/store.js");

    const habitNames = ["A", "B", "C", "D", "E"];
    for (const name of habitNames) {
      await addHabit({
        name, icon: "⭐", identityId: null,
        frequency: { type: "daily" }, timeOfDay: "anytime",
        cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
        stackAnchor: { type: "none" }, tags: [],
      });
    }
    const ids = getState().habits.filter((h) => habitNames.includes(h.name)).map((h) => h.id);

    let unbatchedFireCount = 0;
    const unsubUnbatched = subscribe(() => unbatchedFireCount++);
    for (const id of ids.slice(0, 2)) {
      await archiveHabit(id);
    }
    unsubUnbatched();

    let batchedFireCount = 0;
    const unsubBatched = subscribe(() => batchedFireCount++);
    await batch(async () => {
      for (const id of ids.slice(2)) {
        await archiveHabit(id);
      }
    });
    unsubBatched();

    const allArchived = getState().habits.filter((h) => habitNames.includes(h.name)).every((h) => h.archived);
    return { unbatchedFireCount, batchedFireCount, allArchived };
  });
  if (counts.unbatchedFireCount !== 2) {
    errors.push(`expected 2 unbatched archiveHabit calls to notify listeners 2 times, got ${counts.unbatchedFireCount}`);
  }
  if (counts.batchedFireCount !== 1) {
    errors.push(`expected 3 batched archiveHabit calls to notify listeners exactly once, got ${counts.batchedFireCount}`);
  }
  if (!counts.allArchived) errors.push("batch() should not skip or lose any of the underlying mutations");
  await context.close();
}

await browser.close();
finish("core.spec", errors);
