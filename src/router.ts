export type Route = "today" | "habits" | "identities" | "scorecard" | "dashboard";

export const ROUTES: { route: Route; label: string }[] = [
  { route: "today", label: "Today" },
  { route: "habits", label: "Habits" },
  { route: "identities", label: "Identities" },
  { route: "scorecard", label: "Scorecard" },
  { route: "dashboard", label: "Dashboard" },
];

const VALID = new Set(ROUTES.map((r) => r.route));

/** Splits "#/habits?new=1" into its route and query portions — a PWA shortcut's URL can carry both. */
function hashParts(): { route: string; query: string } {
  const raw = location.hash.replace(/^#\//, "");
  const qIndex = raw.indexOf("?");
  return qIndex === -1 ? { route: raw, query: "" } : { route: raw.slice(0, qIndex), query: raw.slice(qIndex + 1) };
}

export function currentRoute(): Route {
  const { route } = hashParts();
  return VALID.has(route as Route) ? (route as Route) : "today";
}

export function navigateTo(route: Route): void {
  location.hash = `/${route}`;
}

export function onRouteChange(cb: () => void): void {
  window.addEventListener("hashchange", cb);
}

/**
 * Reads a one-shot query param off the current hash (e.g. a PWA shortcut
 * landing on "#/habits?new=1") and immediately strips it from the URL, so a
 * later reload or back/forward navigation doesn't re-trigger the action.
 */
export function consumeShortcutParam(key: string): string | null {
  const { route, query } = hashParts();
  if (!query) return null;
  const value = new URLSearchParams(query).get(key);
  if (value !== null) {
    history.replaceState(null, "", `${location.pathname}${location.search}#/${route}`);
  }
  return value;
}
