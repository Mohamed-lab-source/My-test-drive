import type { DietGoal, DishTag, RecipeSummary } from "../api/types";

/**
 * Mirrors the server's /recipes/recommended scoring (see goalScore in
 * apps/server/src/routes/recipes.ts) for anonymous users, who never hit
 * that endpoint and instead rank the full recipe list on-device.
 */
function goalScore(dietGoal: DietGoal, recipe: RecipeSummary): number {
  const tags = recipe.tags;
  switch (dietGoal) {
    case "LOSE_WEIGHT": {
      const calorieScore = Math.max(0, 3 - recipe.caloriesPerServing / 200);
      const proteinScore = Math.min(2, recipe.proteinPerServing / 15);
      return calorieScore + proteinScore - (tags.includes("DESSERT") ? 1.5 : 0);
    }
    case "BUILD_MUSCLE":
      return recipe.proteinPerServing / 10 + (tags.includes("FIT") ? 1 : 0);
    case "GAIN_WEIGHT":
      return recipe.caloriesPerServing / 200 + (tags.includes("COMFORT") || tags.includes("DESSERT") ? 1 : 0);
    case "FIT":
      return tags.includes("FIT") ? 2 : 0;
    case "INDULGENT":
      return tags.includes("DESSERT") ? 2 : 0;
    default:
      return 0;
  }
}

export function rankRecipes(
  recipes: RecipeSummary[],
  dietGoal: DietGoal,
  favoriteCuisineSlugs: string[]
): RecipeSummary[] {
  const favorites = new Set(favoriteCuisineSlugs);

  return [...recipes]
    .map((recipe) => {
      let score = goalScore(dietGoal, recipe);
      if (favorites.has(recipe.cuisine.slug)) score += 1;
      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.recipe);
}
