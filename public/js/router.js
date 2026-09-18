export const ROUTES = [
    { route: "today", label: "Today", icon: "✓" },
    { route: "habits", label: "Habits", icon: "⚡" },
    { route: "identities", label: "Identities", icon: "★" },
    { route: "scorecard", label: "Scorecard", icon: "≡" },
    { route: "dashboard", label: "Dashboard", icon: "▦" },
];
const VALID = new Set(ROUTES.map((r) => r.route));
export function currentRoute() {
    const hash = location.hash.replace(/^#\//, "");
    return VALID.has(hash) ? hash : "today";
}
export function navigateTo(route) {
    location.hash = `/${route}`;
}
export function onRouteChange(cb) {
    window.addEventListener("hashchange", cb);
}
//# sourceMappingURL=router.js.map