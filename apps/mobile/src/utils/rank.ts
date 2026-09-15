import type { DietGoal, DishTag, RecipeSummary } from "../api/types";

export function rankRecipes(
  recipes: RecipeSummary[],
  dietGoal: DietGoal,
  favoriteCuisineSlugs: string[]
): RecipeSummary[] {
  const wantsTag: DishTag | null = dietGoal === "FIT" ? "FIT" : dietGoal === "INDULGENT" ? "DESSERT" : null;
  const favorites = new Set(favoriteCuisineSlugs);

  return [...recipes]
    .map((recipe) => {
      let score = 0;
      if (wantsTag && recipe.tags.includes(wantsTag)) score += 2;
      if (favorites.has(recipe.cuisine.slug)) score += 1;
      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.recipe);
}
