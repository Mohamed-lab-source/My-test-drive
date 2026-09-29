import type { RecipeSummary } from "../api/types";

export type LeanMuscleTargets = {
  minProtein: number;
  maxFat: number;
  maxMinutes: number;
};

/** Per-serving targets for a quick, high-protein, low-fat meal. */
export const LEAN_MUSCLE_TARGETS: LeanMuscleTargets = {
  minProtein: 25,
  maxFat: 15,
  maxMinutes: 35,
};

function leanScore(r: RecipeSummary): number {
  return r.proteinPerServing - r.fatPerServing * 0.5 - r.caloriesPerServing / 100;
}

function matchesStrict(r: RecipeSummary, t: LeanMuscleTargets): boolean {
  return (
    r.proteinPerServing >= t.minProtein &&
    r.fatPerServing <= t.maxFat &&
    r.prepMinutes + r.cookMinutes <= t.maxMinutes &&
    r.difficulty !== "HARD"
  );
}

/**
 * Picks `days` lean, high-protein, quick-to-cook recipes for a week's plan,
 * sorted by how well each fits (high protein, low fat, moderate calories).
 * Falls back through progressively looser thresholds so it still returns a
 * full week even when the strict pool is too small (e.g. after upstream
 * allergen filtering shrinks the catalog).
 */
export function pickLeanMuscleWeek(recipes: RecipeSummary[], days: number): RecipeSummary[] {
  const minPoolSize = Math.min(days, 4);
  const candidatePools = [
    recipes.filter((r) => matchesStrict(r, LEAN_MUSCLE_TARGETS)),
    recipes.filter(
      (r) => r.proteinPerServing >= LEAN_MUSCLE_TARGETS.minProtein && r.fatPerServing <= LEAN_MUSCLE_TARGETS.maxFat
    ),
    recipes.filter((r) => r.proteinPerServing >= LEAN_MUSCLE_TARGETS.minProtein * 0.7),
    recipes,
  ];
  const pool = candidatePools.find((p) => p.length >= minPoolSize) ?? recipes;
  if (pool.length === 0) return [];

  const sorted = [...pool].sort((a, b) => leanScore(b) - leanScore(a));
  const topSlice = sorted.slice(0, Math.max(days * 2, 10));
  return Array.from({ length: days }, (_, i) => topSlice[i % topSlice.length]);
}
