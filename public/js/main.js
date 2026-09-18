import { loadAll, subscribe } from "./state/store.js";
import { currentRoute, onRouteChange } from "./router.js";
import { renderNav } from "./views/nav.js";
import { renderScorecard } from "./views/scorecard.js";
import { renderIdentities } from "./views/identities.js";
import { renderHabits } from "./views/habits.js";
import { renderToday } from "./views/today.js";
import { renderDashboard } from "./views/dashboard.js";
const VIEW_RENDERERS = {
    today: renderToday,
    habits: renderHabits,
    identities: renderIdentities,
    scorecard: renderScorecard,
    dashboard: renderDashboard,
};
function render() {
    const navEl = document.getElementById("nav");
    const appEl = document.getElementById("app");
    if (!navEl || !appEl)
        return;
    renderNav(navEl);
    VIEW_RENDERERS[currentRoute()](appEl);
}
function renderWithTransition() {
    if ("startViewTransition" in document) {
        document.startViewTransition(render);
    }
    else {
        render();
    }
}
async function main() {
    const appEl = document.getElementById("app");
    if (appEl)
        appEl.innerHTML = `<div class="loading">Loading your habits…</div>`;
    await loadAll();
    render();
    subscribe(render);
    onRouteChange(renderWithTransition);
}
main();
//# sourceMappingURL=main.js.map