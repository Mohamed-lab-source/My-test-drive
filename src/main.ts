import { loadAll, subscribe } from "./state/store.js";
import { currentRoute, onRouteChange, type Route } from "./router.js";
import { renderNav } from "./views/nav.js";
import { renderScorecard } from "./views/scorecard.js";
import { renderIdentities } from "./views/identities.js";
import { renderHabits } from "./views/habits.js";
import { renderToday } from "./views/today.js";
import { renderDashboard } from "./views/dashboard.js";
import { shouldShowOnboarding, renderOnboarding } from "./views/onboarding.js";

const VIEW_RENDERERS: Record<Route, (el: HTMLElement) => void> = {
  today: renderToday,
  habits: renderHabits,
  identities: renderIdentities,
  scorecard: renderScorecard,
  dashboard: renderDashboard,
};

function render(): void {
  const navEl = document.getElementById("nav");
  const appEl = document.getElementById("app");
  if (!navEl || !appEl) return;
  renderNav(navEl);
  VIEW_RENDERERS[currentRoute()](appEl);
}

function renderWithTransition(): void {
  if ("startViewTransition" in document) {
    document.startViewTransition(render);
  } else {
    render();
  }
}

async function main(): Promise<void> {
  const appEl = document.getElementById("app");
  if (appEl) appEl.innerHTML = `<div class="loading">Loading your habits…</div>`;

  await loadAll();

  const start = () => {
    render();
    subscribe(render);
    onRouteChange(renderWithTransition);
  };

  if (shouldShowOnboarding()) {
    renderOnboarding(start);
  } else {
    start();
  }
}

main();
