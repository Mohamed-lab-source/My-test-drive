export type Route = "today" | "habits" | "identities" | "scorecard" | "dashboard";

export const ROUTES: { route: Route; label: string }[] = [
  { route: "today", label: "Today" },
  { route: "habits", label: "Habits" },
  { route: "identities", label: "Identities" },
  { route: "scorecard", label: "Scorecard" },
  { route: "dashboard", label: "Dashboard" },
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
