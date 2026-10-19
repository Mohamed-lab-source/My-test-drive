import type { JournalEntry } from "../context/CookingJournalContext";

/** A typical casual restaurant or delivery main per person in Egypt (EGP). */
export const EATING_OUT_PER_SERVING = 150;
/** Used for journal entries saved before cost was recorded. */
const FALLBACK_HOME_COST = 45;

/** Rough savings from cooking at home instead of ordering the same number of portions. */
export function moneySaved(entries: JournalEntry[]): number {
  return Math.round(
    entries.reduce(
      (sum, e) => sum + Math.max(0, EATING_OUT_PER_SERVING - (e.costPerServing ?? FALLBACK_HOME_COST)) * e.servings,
      0
    )
  );
}
