export const ROUTES = [
    { route: "today", label: "Today" },
    { route: "habits", label: "Habits" },
    { route: "identities", label: "Identities" },
    { route: "scorecard", label: "Scorecard" },
    { route: "dashboard", label: "Dashboard" },
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