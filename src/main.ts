import { loadAll, subscribe } from "./state/store.js";
import { applyTheme } from "./prefs.js";
import { registerServiceWorker, listenForInstallPrompt } from "./pwa.js";
import { initOfflineBanner } from "./offlineBanner.js";
import { scheduleReminderCheck } from "./reminders.js";
import { currentRoute, onRouteChange, consumeShortcutParam, type Route } from "./router.js";
import { renderNav } from "./views/nav.js";
import { renderScorecard } from "./views/scorecard.js";
import { renderIdentities } from "./views/identities.js";
import { renderHabits } from "./views/habits.js";
import { renderToday } from "./views/today.js";
import { renderDashboard } from "./views/dashboard.js";
import { shouldShowOnboarding, renderOnboarding } from "./views/onboarding.js";
import { openHabitWizard } from "./views/habitWizard.js";

const VIEW_RENDERERS: Record<Route, (el: HTMLElement) => void> = {
  today: renderToday,
  habits: renderHabits,
  identities: renderIdentities,
  scorecard: renderScorecard,
  dashboard: renderDashboard,
};

function renderCrashFallback(appEl: HTMLElement, message: string): void {
  appEl.innerHTML = `
    <section class="view crash-fallback">
      <div class="crash-icon">⚠️</div>
      <h1>Something went wrong</h1>
      <p class="muted">${message} Your data is safe — everything is stored only on this device.</p>
      <button type="button" class="btn btn-primary" id="crash-reload">Reload</button>
    </section>
  `;
  appEl.querySelector("#crash-reload")!.addEventListener("click", () => window.location.reload());
}

function render(): void {
  const navEl = document.getElementById("nav");
  const appEl = document.getElementById("app");
  if (!navEl || !appEl) return;
  try {
    renderNav(navEl);
    VIEW_RENDERERS[currentRoute()](appEl);
  } catch (err) {
    console.error("Render failed:", err);
    renderCrashFallback(appEl, "This screen hit an unexpected error.");
  }
}

function renderWithTransition(): void {
  if ("startViewTransition" in document) {
    document.startViewTransition(render);
  } else {
    render();
  }
}

async function main(): Promise<void> {
  applyTheme();
  registerServiceWorker();
  listenForInstallPrompt();
  initOfflineBanner();
  const appEl = document.getElementById("app");
  if (appEl) appEl.innerHTML = `<div class="loading">Loading your habits…</div>`;

  try {
    await loadAll();
  } catch (err) {
    console.error("Failed to load data:", err);
    if (appEl) renderCrashFallback(appEl, "Your habit data couldn't be loaded.");
    return;
  }

  const start = () => {
    render();
    subscribe(render);
    onRouteChange(renderWithTransition);
    scheduleReminderCheck();
    // A PWA shortcut (long-press the home-screen icon) can land here with
    // "#/habits?new=1" to jump straight into adding a habit.
    if (consumeShortcutParam("new") === "1") openHabitWizard();
  };

  if (shouldShowOnboarding()) {
    renderOnboarding(start);
  } else {
    start();
  }
}

main();
