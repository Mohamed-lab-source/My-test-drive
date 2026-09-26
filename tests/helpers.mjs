// Shared Playwright helpers for this repo's regression suite. Every spec
// file under tests/specs/*.spec.mjs is a standalone runnable Node script
// (import { chromium } from "playwright"; ...; process.exit(0|1)) — see
// tests/run.mjs for how they're all launched against a running static
// server and how their exit codes are aggregated.

import { chromium } from "playwright";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8123";

/**
 * Opens a context+page and wires pageerror/console.error straight into the
 * caller's shared `errors` array — passing your own array (rather than
 * reading one back off the return value) is what makes sure a real page
 * error actually fails the spec instead of silently going nowhere.
 */
export async function newTestPage(browser, errors, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return { context, page };
}

export async function gotoAppAndSkipOnboarding(page) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(300);
  const skipBtn = page.locator("#onboarding-skip");
  if (await skipBtn.count()) await skipBtn.click();
  await page.waitForTimeout(300);
}

export async function hasOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

/** Adds an overflow check for the given page state to the shared errors array, tagged with a label. */
export async function checkOverflow(page, errors, label) {
  if (await hasOverflow(page)) errors.push(`OVERFLOW at ${label}`);
}

export { chromium };

/** Call at the end of a spec file: prints a summary and sets the process exit code. */
export function finish(name, errors) {
  if (errors.length) {
    console.log(`\n=== ${name}: FAILED ===`);
    for (const e of errors) console.log(" - " + e);
    process.exit(1);
  } else {
    console.log(`${name}: PASSED`);
    process.exit(0);
  }
}
