// Modal close animation timing (including the reduced-motion bypass and the
// close-then-reopen race that a naive implementation gets wrong), and the
// Web Animations API confetti burst's creation/cleanup/reduced-motion
// behavior.

import { chromium, newTestPage, gotoAppAndSkipOnboarding, checkOverflow, finish } from "../helpers.mjs";

const errors = [];
const browser = await chromium.launch();

// ---- Modal close: normal motion timing ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
  await page.click("a[href='#/dashboard']");
  await page.waitForTimeout(400);
  await page.click("#open-achievements");
  await page.waitForTimeout(300);
  await page.click("#achievements-close");

  const closingImmediately = await page.evaluate(() => {
    const sheet = document.querySelector(".modal-sheet");
    return sheet ? sheet.classList.contains("modal-closing") : "no-sheet";
  });
  if (closingImmediately !== true) errors.push(`expected modal-closing class immediately after close(), got: ${closingImmediately}`);

  await page.waitForTimeout(400);
  const cleared = await page.evaluate(() => document.getElementById("modal-root").innerHTML.trim() === "");
  if (!cleared) errors.push("modal-root did not clear after the close animation duration");
  await context.close();
}

// ---- Modal close: reduced motion skips the delay ----
{
  const { context, page } = await newTestPage(browser, errors, { reducedMotion: "reduce" });
  await gotoAppAndSkipOnboarding(page);
  await page.click("a[href='#/dashboard']");
  await page.waitForTimeout(400);
  await page.click("#open-achievements");
  await page.waitForTimeout(300);
  await page.click("#achievements-close");
  await page.waitForTimeout(50);
  const clearedImmediately = await page.evaluate(() => document.getElementById("modal-root").innerHTML.trim() === "");
  if (!clearedImmediately) errors.push("reduced-motion close did not skip the animation delay");
  await context.close();
}

// ---- Modal race: close() immediately followed by opening a new modal must not get wiped ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
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
  await page.click("a[href='#/habits']");
  await page.waitForTimeout(300);
  await page.locator(".habit-card").first().click();
  await page.waitForTimeout(300);
  await page.click("#detail-edit");
  await page.waitForTimeout(500); // past the close-animation window
  const wizardStillVisible = await page.locator("#wizard-name").count();
  if (wizardStillVisible === 0) errors.push("REGRESSION: wizard got wiped out by a stale close() timeout after Edit");
  await context.close();
}

// ---- Confetti: creates pieces, cleans them up, respects reduced motion ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
  const pieceCount = await page.evaluate(async () => {
    const { celebrate } = await import("/js/confetti.js");
    celebrate({ x: 100, y: 100 });
    await new Promise((r) => setTimeout(r, 50));
    return document.querySelectorAll(".confetti-piece").length;
  });
  if (pieceCount !== 24) errors.push(`expected 24 confetti pieces, got ${pieceCount}`);
  await page.waitForTimeout(1300);
  const layersLeft = await page.evaluate(() => document.querySelectorAll(".confetti-layer").length);
  if (layersLeft !== 0) errors.push(`confetti layer not cleaned up, ${layersLeft} remaining`);
  await context.close();
}

{
  const { context, page } = await newTestPage(browser, errors, { reducedMotion: "reduce" });
  await gotoAppAndSkipOnboarding(page);
  const pieceCount = await page.evaluate(async () => {
    const { celebrate } = await import("/js/confetti.js");
    celebrate({ x: 100, y: 100 });
    await new Promise((r) => setTimeout(r, 50));
    return document.querySelectorAll(".confetti-piece").length;
  });
  if (pieceCount !== 0) errors.push(`expected 0 confetti pieces under reduced motion, got ${pieceCount}`);
  await context.close();
}

// ---- Keyboard: Escape closes a modal, Tab traps focus within it ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
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
  await page.click("a[href='#/habits']");
  await page.waitForTimeout(300);

  const card = page.locator(".habit-card").first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(250);

  const actionButtons = page.locator(".quick-action-btn");
  const cancelBtn = page.locator("#quick-actions-cancel");

  // Tab from the last focusable element (Cancel) should wrap to the first (Edit).
  await cancelBtn.focus();
  await page.keyboard.press("Tab");
  const focusedAfterWrap = await page.evaluate(() => document.activeElement?.textContent?.trim());
  const firstActionLabel = (await actionButtons.first().textContent())?.trim();
  if (focusedAfterWrap !== firstActionLabel) {
    errors.push(`expected Tab from the last focusable element to wrap to "${firstActionLabel}", got "${focusedAfterWrap}"`);
  }

  // Shift+Tab from the first element should wrap to the last (Cancel).
  await actionButtons.first().focus();
  await page.keyboard.press("Shift+Tab");
  const focusedAfterShiftWrap = await page.evaluate(() => document.activeElement?.id);
  if (focusedAfterShiftWrap !== "quick-actions-cancel") {
    errors.push(`expected Shift+Tab from the first focusable element to wrap to Cancel, got "${focusedAfterShiftWrap}"`);
  }

  // Escape closes the sheet.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if ((await page.locator(".quick-actions-sheet").count()) !== 0) {
    errors.push("Escape did not close the quick-actions sheet");
  }

  await context.close();
}

// ---- ARIA pass: toggle labels, icon-picker aria-pressed, progressbars, heatmap keyboard activation ----
{
  const { context, page } = await newTestPage(browser, errors);
  await gotoAppAndSkipOnboarding(page);
  await page.evaluate(async () => {
    const { addHabit, setCheckIn } = await import("/js/state/store.js");
    await addHabit({
      name: "Read", icon: "📖", identityId: null,
      frequency: { type: "daily" }, timeOfDay: "anytime",
      cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
      stackAnchor: { type: "none" }, tags: [],
    });
  });
  await page.waitForTimeout(200);

  // Toggle switches need a programmatic name — the visible label text sits
  // in a sibling span, not inside the <label> that wraps the checkbox.
  await page.click("a[href='#/dashboard']");
  await page.waitForTimeout(400);
  await page.click("#open-settings");
  await page.waitForTimeout(300);
  const soundAriaLabel = await page.locator("#pref-sound").getAttribute("aria-label");
  const hapticsAriaLabel = await page.locator("#pref-haptics").getAttribute("aria-label");
  if (soundAriaLabel !== "Sound") errors.push(`expected #pref-sound aria-label "Sound", got "${soundAriaLabel}"`);
  if (hapticsAriaLabel !== "Haptics") errors.push(`expected #pref-haptics aria-label "Haptics", got "${hapticsAriaLabel}"`);

  // Level-up progress bar should expose its value, not just its width.
  const levelValueNow = await page.locator(".level-progress-track").getAttribute("aria-valuenow");
  if (levelValueNow === null || Number.isNaN(Number(levelValueNow))) {
    errors.push(`level progress bar missing a numeric aria-valuenow, got "${levelValueNow}"`);
  }
  await page.click("#settings-close");
  await page.waitForTimeout(400);

  // Icon picker: aria-pressed should track the actual selection, not just the CSS class.
  await page.click("a[href='#/habits']");
  await page.waitForTimeout(300);
  await page.locator(".habit-card", { hasText: "Read" }).first().click();
  await page.waitForTimeout(300);
  await page.click("#detail-edit");
  await page.waitForTimeout(400);

  const bookChoice = page.locator(".icon-choice[data-icon='📖']");
  const runChoice = page.locator(".icon-choice[data-icon='🏃']");
  if ((await bookChoice.getAttribute("aria-pressed")) !== "true") {
    errors.push("expected the currently-selected icon to have aria-pressed=true");
  }
  await runChoice.click();
  await page.waitForTimeout(150);
  if ((await runChoice.getAttribute("aria-pressed")) !== "true") {
    errors.push("expected the newly-selected icon to have aria-pressed=true after clicking it");
  }
  if ((await bookChoice.getAttribute("aria-pressed")) !== "false") {
    errors.push("expected the previously-selected icon to have aria-pressed=false after selecting a different one");
  }
  await page.click("#wizard-close");
  await page.waitForTimeout(400);

  // Heatmap cells: keyboard-focusable and Enter-activatable, not mouse-only.
  await page.locator(".habit-card", { hasText: "Read" }).first().click();
  await page.waitForTimeout(300);
  const heatCell = page.locator(".heat-cell-tappable").first();
  if ((await heatCell.getAttribute("role")) !== "button") {
    errors.push("expected a tappable heatmap cell to have role=\"button\"");
  }
  await heatCell.focus();
  const checkinsBefore = await page.evaluate(async () => (await import("/js/state/store.js")).getState().checkins.length);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const checkinsAfter = await page.evaluate(async () => (await import("/js/state/store.js")).getState().checkins.length);
  if (checkinsAfter <= checkinsBefore) {
    errors.push(`expected Enter on a focused heatmap cell to log a check-in (before=${checkinsBefore}, after=${checkinsAfter})`);
  }
  await page.click("#detail-close");
  await page.waitForTimeout(400);

  await context.close();
}

// ---- Tablet/landscape layout: bottom tab bar becomes a sticky left sidebar ----
{
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await gotoAppAndSkipOnboarding(page);

  const navBox = await page.locator("#nav").boundingBox();
  const appBox = await page.locator("#app").boundingBox();
  const shellBox = await page.locator(".app-shell").boundingBox();
  if (!navBox || !appBox || !shellBox) {
    errors.push("couldn't measure #nav/#app/.app-shell at tablet width");
  } else {
    if (Math.abs(navBox.x - shellBox.x) > 2) {
      errors.push(`expected the nav rail flush against the left edge of the centered app shell, shell x=${shellBox.x}, nav x=${navBox.x}`);
    }
    if (navBox.height < 400) errors.push(`expected a full-height sidebar at tablet width, got height=${navBox.height}`);
    if (appBox.x <= navBox.x + navBox.width - 10) {
      errors.push(`expected app content to sit to the right of the nav rail, nav ends at ${navBox.x + navBox.width}, app starts at ${appBox.x}`);
    }
  }
  const navPosition = await page.evaluate(() => getComputedStyle(document.getElementById("nav")).position);
  if (navPosition !== "sticky") errors.push(`expected the nav rail to be position:sticky at tablet width, got "${navPosition}"`);

  for (const route of ["today", "habits", "identities", "scorecard", "dashboard"]) {
    await page.click(`a[href='#/${route}']`);
    await page.waitForTimeout(300);
    await checkOverflow(page, errors, `tablet-width/${route}`);
  }

  await context.close();
}

await browser.close();
finish("ui-polish.spec", errors);
