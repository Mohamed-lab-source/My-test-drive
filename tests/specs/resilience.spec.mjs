// The global error boundary: a genuinely malformed habit record (as could
// result from restoring a hand-edited/corrupted backup) must not take down
// the whole app with a blank screen — render() should catch it and show a
// recoverable fallback instead.
//
// This spec deliberately triggers that error path, so unlike every other
// spec it does NOT treat console.error as an automatic failure — render()
// intentionally logs "Render failed: ..." when it catches something, and
// that log is itself proof the boundary did its job. Only unexpected
// console.error output (anything not matching that prefix) fails this spec.

import { chromium, gotoAppAndSkipOnboarding, finish } from "../helpers.mjs";

const errors = [];
let sawExpectedRenderFailureLog = false;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (m.text().includes("Render failed:")) {
    sawExpectedRenderFailureLog = true;
  } else {
    errors.push(`unexpected console.error: ${m.text()}`);
  }
});

await gotoAppAndSkipOnboarding(page);

await page.evaluate(async () => {
  const { put } = await import("/js/db/idb.js");
  await put("habits", {
    id: "malformed-habit",
    name: "Broken",
    icon: "💥",
    identityId: null,
    frequency: {}, // missing `type` — frequencyLabel()/isDue() both dereference it, which throws
    timeOfDay: "anytime",
    cue: "", craving: "", response: "", reward: "", twoMinuteVersion: "",
    stackAnchor: { type: "none" },
    tags: [],
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    archived: false,
  });
  const { loadAll } = await import("/js/state/store.js");
  await loadAll();
});
await page.waitForTimeout(300);

await page.click("a[href='#/habits']");
await page.waitForTimeout(400);

if (!(await page.locator(".crash-fallback").count())) {
  errors.push("crash fallback did not appear after a malformed record caused a render error");
}
if (!(await page.locator("#crash-reload").count())) {
  errors.push("reload button missing from crash fallback");
}
if (!(await page.locator(".tab-bar .tab-item").count())) {
  errors.push("nav bar was also broken by the render crash (should render before the crashing view)");
}
if (!sawExpectedRenderFailureLog) {
  errors.push("expected render() to log a 'Render failed:' console.error when it caught the crash, but none was seen");
}

await context.close();
await browser.close();
finish("resilience.spec", errors);
