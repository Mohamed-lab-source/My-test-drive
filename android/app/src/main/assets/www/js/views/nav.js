import { ROUTES, currentRoute } from "../router.js";
export function renderNav(container) {
    const active = currentRoute();
    container.innerHTML = `
    <div class="nav-brand">Atomic</div>
    <div class="nav-links">
      ${ROUTES.map((r) => `
        <a class="nav-link ${r.route === active ? "active" : ""}" href="#/${r.route}">
          <span class="nav-icon" aria-hidden="true">${r.icon}</span>
          <span>${r.label}</span>
        </a>`).join("")}
    </div>
  `;
}
//# sourceMappingURL=nav.js.map