/** The fields of a localized recipe summary that filtering, sorting and stats need. */
export type SummaryLike = {
  slug: string;
  title: string;
  prepMinutes: number;
  cookMinutes: number;
  costPerServing: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  avgRating: number | null;
  tags: string[];
  cuisine: { slug: string; name: string };
};

export type NumericFilters = {
  maxCalories?: number;
  minProtein?: number;
  maxCost?: number;
  maxMinutes?: number;
};

export const SORT_KEYS = ["title", "cost", "calories", "protein", "time", "rating"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * Nutrition and cost are derived from ingredients rather than stored, so
 * these filters run on computed summaries instead of in the database query.
 */
export function applyNumericFilters<T extends SummaryLike>(items: T[], f: NumericFilters): T[] {
  return items.filter(
    (r) =>
      (f.maxCalories == null || r.caloriesPerServing <= f.maxCalories) &&
      (f.minProtein == null || r.proteinPerServing >= f.minProtein) &&
      (f.maxCost == null || r.costPerServing <= f.maxCost) &&
      (f.maxMinutes == null || r.prepMinutes + r.cookMinutes <= f.maxMinutes)
  );
}

/** Cheapest/lightest/fastest first, or most protein/best rated first; ties fall back to title. */
export function sortSummaries<T extends SummaryLike>(items: T[], sort: SortKey): T[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title);
  const key: Record<SortKey, (a: T, b: T) => number> = {
    title: byTitle,
    cost: (a, b) => a.costPerServing - b.costPerServing,
    calories: (a, b) => a.caloriesPerServing - b.caloriesPerServing,
    protein: (a, b) => b.proteinPerServing - a.proteinPerServing,
    time: (a, b) => a.prepMinutes + a.cookMinutes - (b.prepMinutes + b.cookMinutes),
    // Unrated recipes go last.
    rating: (a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1),
  };
  return [...items].sort((a, b) => key[sort](a, b) || byTitle(a, b));
}

export type CuisineStats = {
  slug: string;
  name: string;
  recipeCount: number;
  avgCostPerServing: number;
  avgCalories: number;
  avgMinutes: number;
  avgRating: number | null;
  quickCount: number;
  vegetarianCount: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Per-cuisine averages over recipe summaries, most recipes first. */
export function computeCuisineStats(items: SummaryLike[]): CuisineStats[] {
  const groups = new Map<string, SummaryLike[]>();
  for (const r of items) {
    const list = groups.get(r.cuisine.slug);
    if (list) list.push(r);
    else groups.set(r.cuisine.slug, [r]);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return [...groups.values()]
    .map((recipes) => {
      const rated = recipes.filter((r) => r.avgRating != null).map((r) => r.avgRating as number);
      return {
        slug: recipes[0].cuisine.slug,
        name: recipes[0].cuisine.name,
        recipeCount: recipes.length,
        avgCostPerServing: round1(avg(recipes.map((r) => r.costPerServing))),
        avgCalories: Math.round(avg(recipes.map((r) => r.caloriesPerServing))),
        avgMinutes: Math.round(avg(recipes.map((r) => r.prepMinutes + r.cookMinutes))),
        avgRating: rated.length ? round1(avg(rated)) : null,
        quickCount: recipes.filter((r) => r.tags.includes("QUICK")).length,
        vegetarianCount: recipes.filter((r) => r.tags.includes("VEGETARIAN")).length,
      };
    })
    .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name));
}
