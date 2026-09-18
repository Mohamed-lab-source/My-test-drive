export type Route = "today" | "habits" | "identities" | "scorecard" | "dashboard";

export const ROUTES: { route: Route; label: string; icon: string }[] = [
  { route: "today", label: "Today", icon: "✓" },
  { route: "habits", label: "Habits", icon: "⚡" },
  { route: "identities", label: "Identities", icon: "★" },
  { route: "scorecard", label: "Scorecard", icon: "≡" },
  { route: "dashboard", label: "Dashboard", icon: "▦" },
];

const VALID = new Set(ROUTES.map((r) => r.route));

export function currentRoute(): Route {
  const hash = location.hash.replace(/^#\//, "");
  return VALID.has(hash as Route) ? (hash as Route) : "today";
}

export function navigateTo(route: Route): void {
  location.hash = `/${route}`;
}

export function onRouteChange(cb: () => void): void {
  window.addEventListener("hashchange", cb);
}
