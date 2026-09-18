import { ROUTES, currentRoute } from "../router.js";
import { icons } from "../icons.js";
const ICON_MAP = {
    today: icons.today,
    habits: icons.habits,
    identities: icons.identities,
    scorecard: icons.scorecard,
    dashboard: icons.dashboard,
};
export function renderNav(container) {
    const active = currentRoute();
    container.innerHTML = ROUTES.map((r) => `
      <a class="tab-item ${r.route === active ? "active" : ""}" href="#/${r.route}">
        <span class="tab-icon">${ICON_MAP[r.route]}</span>
        <span class="tab-label">${r.label}</span>
      </a>`).join("");
}
//# sourceMappingURL=nav.js.map