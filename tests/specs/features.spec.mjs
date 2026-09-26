// Regression checks for the "20 improvements" round: archived-item
// recovery, CSV import, identity icons, Year in Review, global search, and
// whatever else lands in that batch. Grown incrementally as each feature is
// built, verified once here, then never re-derived by hand again.

import { chromium, newTestPage, gotoAppAndSkipOnboarding, checkOverflow, finish, BASE_URL } from "../helpers.mjs";

const errors = [];
const browser = await chromium.launch();
const { context, page } = await newTestPage(browser, errors, { permissions: ["clipboard-read", "clipboard-write"] });
await gotoAppAndSkipOnboarding(page);

// ---- Archived habits/identities: recoverable after the undo window ----
await page.evaluate(async () => {
  const { addHabit, addIdentity, archiveHabit, archiveIdentity, getState } = await import("/js/state/store.js");
  await addHabit({
    name: "Meditate", icon: "🧘", identityId: null,
    frequency: { type: "daily" }, timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" }, tags: [],
  });
  await addIdentity("a calm person");
  const habit = getState().habits.find((h) => h.name === "Meditate");
  const identity = getState().identities.find((i) => i.statement === "a calm person");
  // Archive directly (not via the undo-snackbar flow) to simulate the undo
  // window having already expired.
  await archiveHabit(habit.id);
  await archiveIdentity(identity.id);
});
await page.waitForTimeout(200);

await page.click("a[href='#/dashboard']");
await page.waitForTimeout(400);
await page.click("#open-settings");
await page.waitForTimeout(300);
await checkOverflow(page, errors, "settings-with-archived-count");

const archivedBtnText = await page.locator("#open-archived-btn").textContent();
if (!archivedBtnText || !archivedBtnText.includes("2")) {
  errors.push(`expected archived count of 2 in Settings, got: "${archivedBtnText}"`);
}

await page.click("#open-archived-btn");
await page.waitForTimeout(400); // settings close animation + archived open
await checkOverflow(page, errors, "archived-screen");

const habitRestoreBtn = page.locator("[data-restore-habit]");
const identityRestoreBtn = page.locator("[data-restore-identity]");
if ((await habitRestoreBtn.count()) === 0) errors.push("no restore button for archived habit");
if ((await identityRestoreBtn.count()) === 0) errors.push("no restore button for archived identity");

await habitRestoreBtn.click();
await page.waitForTimeout(300);
await identityRestoreBtn.click();
await page.waitForTimeout(300);

const restoredCounts = await page.evaluate(async () => {
  const { getState } = await import("/js/state/store.js");
  const s = getState();
  return {
    habit: s.habits.find((h) => h.name === "Meditate")?.archived,
    identity: s.identities.find((i) => i.statement === "a calm person")?.archived,
  };
});
if (restoredCounts.habit !== false) errors.push(`habit not restored, archived=${restoredCounts.habit}`);
if (restoredCounts.identity !== false) errors.push(`identity not restored, archived=${restoredCounts.identity}`);

const emptyStates = await page.locator(".archived-row").count();
if (emptyStates !== 0) errors.push(`expected 0 archived rows left after restoring both, got ${emptyStates}`);

await page.click("#archived-close");
await page.waitForTimeout(400);

// ---- CSV import ----
await page.evaluate(async () => {
  const { addHabit } = await import("/js/state/store.js");
  await addHabit({
    name: "Journal", icon: "✍️", identityId: null,
    frequency: { type: "daily" }, timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" }, tags: [],
  });
});
await page.waitForTimeout(200);

await page.click("#open-settings");
await page.waitForTimeout(300);
const csvSample = "habit,date,status\nJournal,2026-01-01,full\nJournal,2026-01-02,two-minute\nGhost Habit,2026-01-01,full\nbad,row";
await page.fill("#csv-import-text", csvSample);
await page.click("#csv-import-review-btn");
await page.waitForTimeout(200);

const summaryText = await page.locator("#csv-import-summary").textContent();
if (!summaryText || !summaryText.includes("2 check-ins")) {
  errors.push(`CSV import preview summary unexpected: "${summaryText}"`);
}
if (!summaryText || !summaryText.includes("Ghost Habit")) {
  errors.push(`CSV import preview should call out the unmatched "Ghost Habit" row: "${summaryText}"`);
}

await page.click("#csv-import-confirm-btn");
await page.waitForTimeout(400);

const importedCount = await page.evaluate(async () => {
  const { getState } = await import("/js/state/store.js");
  const { isVote } = await import("/js/domain/analytics.js");
  const s = getState();
  const habit = s.habits.find((h) => h.name === "Journal");
  return s.checkins.filter((c) => c.habitId === habit.id && isVote(c)).length;
});
if (importedCount !== 2) errors.push(`expected 2 imported check-ins for Journal, got ${importedCount}`);

// ---- Custom identity icon ----
await page.click("a[href='#/identities']");
await page.waitForTimeout(300);
const identityIconOnCard = await page.locator(".identity-statement .habit-icon").first().textContent();
if (identityIconOnCard !== "🧭") {
  errors.push(`expected default identity icon 🧭 on card, got "${identityIconOnCard}"`);
}

await page.locator(".identity-card-main").first().click();
await page.waitForTimeout(300);
await page.click("#identity-edit");
await page.waitForTimeout(200);
await page.click(".icon-choice[data-icon='💪']");
await page.waitForTimeout(150);
await page.click("#identity-save");
await page.waitForTimeout(300);

const heroIconAfterSave = await page.locator(".detail-hero-icon").textContent();
if (heroIconAfterSave !== "💪") {
  errors.push(`identity icon change didn't persist, hero shows "${heroIconAfterSave}"`);
}

const monthCardTitle = await page.locator(".card-title", { hasText: "so far" }).textContent();
const expectedMonthName = new Date().toLocaleDateString(undefined, { month: "long" });
if (!monthCardTitle || !monthCardTitle.includes(expectedMonthName)) {
  errors.push(`expected identity detail's month card titled with "${expectedMonthName}", got "${monthCardTitle}"`);
}
if ((await page.locator(".month-compare").count()) === 0) {
  errors.push("identity detail is missing the month-over-month comparison line");
}
await checkOverflow(page, errors, "identity-detail-with-month-card");

await page.click("#detail-close");
await page.waitForTimeout(400);
await checkOverflow(page, errors, "identities-with-icons");

const iconOnCardAfterSave = await page.locator(".identity-statement .habit-icon").first().textContent();
if (iconOnCardAfterSave !== "💪") {
  errors.push(`identity list card didn't reflect the new icon, got "${iconOnCardAfterSave}"`);
}

// ---- Year in Review ----
await page.click("a[href='#/dashboard']");
await page.waitForTimeout(400);
await page.click("#open-settings");
await page.waitForTimeout(300);
await page.click("#open-year-review-btn");
await page.waitForTimeout(400);
await checkOverflow(page, errors, "year-in-review");

const yearReviewVotes = await page.locator(".year-review-value").textContent();
const expectedVotesThisYear = await page.evaluate(async () => {
  const { getState } = await import("/js/state/store.js");
  const { isVote } = await import("/js/domain/analytics.js");
  const year = new Date().getFullYear().toString();
  return getState().checkins.filter((c) => isVote(c) && c.date.startsWith(year)).length;
});
if (yearReviewVotes !== String(expectedVotesThisYear)) {
  errors.push(`Year in Review vote count mismatch: shown "${yearReviewVotes}" vs computed ${expectedVotesThisYear}`);
}

const shareBtn = page.locator("#year-review-share");
if ((await shareBtn.count()) === 0) errors.push("Year in Review share button missing");
await shareBtn.click();
await page.waitForTimeout(200);
const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
if (clipboardText && !clipboardText.includes("Atomic Habits")) {
  errors.push(`Year in Review share/clipboard text looks wrong: "${clipboardText}"`);
}

await page.click("#year-review-close");
await page.waitForTimeout(400);

// ---- Global search ----
await page.evaluate(async () => {
  const { addScorecardEntry } = await import("/js/state/store.js");
  await addScorecardEntry("Check phone right after waking up", "-");
});
await page.waitForTimeout(200);

await page.click("a[href='#/dashboard']");
await page.waitForTimeout(400);
await page.click("#open-search");
await page.waitForTimeout(300);
await checkOverflow(page, errors, "search-empty");

await page.fill("#global-search-input", "journal");
await page.waitForTimeout(200);
await checkOverflow(page, errors, "search-with-results");
const habitResultCount = await page.locator("[data-open-habit]").count();
if (habitResultCount < 1) errors.push(`expected at least 1 habit result for "journal", got ${habitResultCount}`);

// Clear and search for something matching a scorecard entry instead.
await page.fill("#global-search-input", "phone");
await page.waitForTimeout(200);
const scorecardResultCount = await page.locator("[data-open-scorecard]").count();
if (scorecardResultCount !== 1) errors.push(`expected 1 scorecard result for "phone", got ${scorecardResultCount}`);

// No-match state
await page.fill("#global-search-input", "zzz-nonexistent-zzz");
await page.waitForTimeout(200);
const noMatchText = await page.locator(".empty-state p").textContent();
if (!noMatchText || !noMatchText.includes("No matches")) {
  errors.push(`expected a no-matches empty state, got: "${noMatchText}"`);
}

// Tapping a habit result closes search and opens habit detail.
await page.fill("#global-search-input", "journal");
await page.waitForTimeout(200);
await page.locator("[data-open-habit]").first().click();
await page.waitForTimeout(400);
const habitDetailOpen = await page.locator(".detail-hero-name").count();
if (habitDetailOpen === 0) errors.push("tapping a habit search result didn't open habit detail");
const searchStillOpen = await page.locator("#global-search-input").count();
if (searchStillOpen !== 0) errors.push("search sheet should have closed after selecting a result");
await page.click("#detail-close");
await page.waitForTimeout(400);

// ---- Local reminder notifications ----
await page.click("#open-settings");
await page.waitForTimeout(300);
await checkOverflow(page, errors, "settings-with-reminders-card");

const enableNotifBtn = page.locator("#enable-notifications-btn");
if ((await enableNotifBtn.count()) !== 1) {
  errors.push(`expected the "Enable notifications" button before permission is granted, found ${await enableNotifBtn.count()}`);
}
if ((await page.locator("#reminder-time-input").count()) !== 0) {
  errors.push("reminder time input shouldn't be shown before notification permission is granted");
}

// Headless Chromium doesn't honor context.grantPermissions(["notifications"])
// for the Notification API (a known headless limitation, not an app bug), so
// the "granted" path is exercised by stubbing the API directly instead of
// trying to drive a real permission grant through it.
await page.addInitScript(() => {
  Object.defineProperty(window.Notification, "permission", { value: "granted", configurable: true });
  window.Notification.requestPermission = async () => "granted";
});
await page.reload();
await page.waitForTimeout(300);
await page.click("a[href='#/dashboard']");
await page.waitForTimeout(300);
await page.click("#open-settings");
await page.waitForTimeout(300);

const reminderTimeInput = page.locator("#reminder-time-input");
if ((await reminderTimeInput.count()) !== 1) {
  errors.push("reminder time input should appear once notification permission is granted");
}
if ((await page.locator("#enable-notifications-btn").count()) !== 0) {
  errors.push("\"Enable notifications\" button should be gone once permission is granted");
}

await reminderTimeInput.fill("08:30");
await reminderTimeInput.dispatchEvent("change");
await page.waitForTimeout(200);

const savedReminderTime = await page.evaluate(async () => {
  const { getPrefs } = await import("/js/prefs.js");
  return getPrefs().reminderTime;
});
if (savedReminderTime !== "08:30") {
  errors.push(`reminder time preference didn't persist, got "${savedReminderTime}"`);
}

await page.click("#settings-close");
await page.waitForTimeout(400);

// ---- PWA app shortcut: "Add a habit" (#/habits?new=1) opens the wizard and cleans up the URL ----
{
  const { context: shortcutContext, page: shortcutPage } = await newTestPage(browser, errors);
  await shortcutPage.goto(`${BASE_URL}#/habits?new=1`);
  await shortcutPage.waitForTimeout(300);
  const skipBtn = shortcutPage.locator("#onboarding-skip");
  if (await skipBtn.count()) await skipBtn.click();
  await shortcutPage.waitForTimeout(400);

  const wizardOpened = await shortcutPage.locator("#wizard-close").count();
  if (wizardOpened === 0) {
    errors.push('expected navigating to "#/habits?new=1" to open the add-habit wizard automatically');
  }
  const hashAfter = await shortcutPage.evaluate(() => location.hash);
  if (hashAfter !== "#/habits") {
    errors.push(`expected the shortcut's "?new=1" query to be stripped from the URL after consuming it, got "${hashAfter}"`);
  }
  await shortcutContext.close();
}

// ---- Manifest shortcuts are well-formed ----
const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
if (!Array.isArray(manifest.shortcuts) || manifest.shortcuts.length < 3) {
  errors.push(`expected at least 3 PWA shortcuts in the manifest, got: ${JSON.stringify(manifest.shortcuts)}`);
}
for (const s of manifest.shortcuts ?? []) {
  if (!s.name || !s.url) errors.push(`manifest shortcut missing name/url: ${JSON.stringify(s)}`);
}

// ---- Manifest icons: real PNGs at standard PWA sizes, each actually fetchable ----
const pngIcons = (manifest.icons ?? []).filter((i) => i.type === "image/png");
if (pngIcons.length < 3) {
  errors.push(`expected at least 3 PNG manifest icons (192 any, 512 any, 512 maskable), got: ${JSON.stringify(manifest.icons)}`);
}
if (!pngIcons.some((i) => i.sizes === "192x192" && i.purpose === "any")) {
  errors.push('missing a 192x192 "any" purpose PNG icon');
}
if (!pngIcons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")) {
  errors.push('missing a 512x512 "maskable" purpose PNG icon');
}
for (const icon of pngIcons) {
  const res = await page.evaluate(async (src) => {
    const r = await fetch(src);
    return { ok: r.ok, contentType: r.headers.get("content-type") };
  }, icon.src);
  if (!res.ok) errors.push(`manifest PNG icon "${icon.src}" did not fetch successfully`);
  if (res.contentType && !res.contentType.includes("image/png")) {
    errors.push(`manifest PNG icon "${icon.src}" served with unexpected content-type "${res.contentType}"`);
  }
}
const appleTouchIconHref = await page.evaluate(
  () => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href")
);
if (!appleTouchIconHref || !appleTouchIconHref.endsWith(".png")) {
  errors.push(`expected apple-touch-icon to point at a PNG (iOS doesn't render SVG there), got "${appleTouchIconHref}"`);
}

// ---- Long-press quick actions ----
async function longPress(x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

await page.evaluate(async () => {
  const { addHabit, addIdentity } = await import("/js/state/store.js");
  await addHabit({
    name: "Read", icon: "📖", identityId: null,
    frequency: { type: "daily" }, timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" }, tags: [],
  });
  await addIdentity("a reader");
});
await page.waitForTimeout(200);

await page.click("a[href='#/habits']");
await page.waitForTimeout(400);

const readCard = page.locator(".habit-card", { hasText: "Read" }).first();
const readBox = await readCard.boundingBox();
if (!readBox) {
  errors.push("couldn't find the Read habit card for the long-press test");
} else {
  const cx = readBox.x + readBox.width / 2;
  const cy = readBox.y + 20; // near the top, clear of the footer's Edit/Archive buttons

  await longPress(cx, cy);
  const sheetTitle = await page.locator(".quick-actions-title").textContent();
  if (sheetTitle !== "Read") errors.push(`expected quick actions title "Read", got "${sheetTitle}"`);
  await checkOverflow(page, errors, "quick-actions-habit");

  await page.locator(".quick-action-btn", { hasText: "Edit" }).click();
  await page.waitForTimeout(400);
  const wizardNameValue = await page.locator("#wizard-name").inputValue();
  if (wizardNameValue !== "Read") errors.push(`expected wizard prefilled with "Read", got "${wizardNameValue}"`);
  await page.click("#wizard-close");
  await page.waitForTimeout(400);

  await longPress(cx, cy);
  await page.locator(".quick-action-btn", { hasText: "Duplicate" }).click();
  await page.waitForTimeout(400);
  const duplicateNameValue = await page.locator("#wizard-name").inputValue();
  if (duplicateNameValue !== "Read copy") {
    errors.push(`expected duplicated wizard name "Read copy", got "${duplicateNameValue}"`);
  }
  await page.click("#wizard-close");
  await page.waitForTimeout(400);

  await longPress(cx, cy);
  await page.locator(".quick-action-btn.quick-action-danger", { hasText: "Archive" }).click();
  await page.waitForTimeout(300);
  const readStillVisible = await page.locator(".habit-card", { hasText: "Read" }).count();
  if (readStillVisible !== 0) {
    errors.push("Read habit should be archived (removed from list) after the quick-action Archive");
  }
  await page.locator(".snackbar-action", { hasText: "Undo" }).click();
  await page.waitForTimeout(300);
}

await page.click("a[href='#/identities']");
await page.waitForTimeout(400);

const readerCard = page.locator("[data-open-identity]", { hasText: "a reader" }).first();
const readerBox = await readerCard.boundingBox();
if (!readerBox) {
  errors.push("couldn't find the \"a reader\" identity card for the long-press test");
} else {
  await longPress(readerBox.x + readerBox.width / 2, readerBox.y + 15);
  const identitySheetTitle = await page.locator(".quick-actions-title").textContent();
  if (identitySheetTitle !== "I am a reader") {
    errors.push(`expected identity quick actions title "I am a reader", got "${identitySheetTitle}"`);
  }
  await page.locator(".quick-action-btn.quick-action-danger", { hasText: "Archive" }).click();
  await page.waitForTimeout(300);
  const readerStillVisible = await page.locator("[data-open-identity]", { hasText: "a reader" }).count();
  if (readerStillVisible !== 0) {
    errors.push("identity should be archived (removed from list) after the quick-action Archive");
  }
}

// ---- Dashboard time-series line chart ----
await page.evaluate(async () => {
  const { getState, setCheckIn } = await import("/js/state/store.js");
  const { todayISO } = await import("/js/utils/date.js");
  const habit = getState().habits.find((h) => !h.archived);
  if (habit) await setCheckIn(habit.id, todayISO(), "full");
});
await page.waitForTimeout(200);

await page.click("a[href='#/dashboard']");
await page.waitForTimeout(400);
await checkOverflow(page, errors, "dashboard-with-line-chart");

const lineChartCount = await page.locator(".line-chart-svg").count();
if (lineChartCount !== 1) {
  errors.push(`expected the daily-votes line chart to render once there's vote data, found ${lineChartCount}`);
}

await context.close();
await browser.close();
finish("features.spec", errors);
