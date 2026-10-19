import { describe, expect, it } from "vitest";
import {
  CATALOG_RECIPE_COUNT,
  answerLocally,
  cuisineStats,
  listCuisines,
  listIngredients,
  listRecipes,
  pantryMatch,
  randomRecipe,
  recipeDetail,
  shoppingList,
} from "../localCatalog";
import type { RecipeDetail, RecipeSummary } from "../types";

describe("bundled catalog", () => {
  it("ships the full catalog with cuisines that add up", () => {
    expect(CATALOG_RECIPE_COUNT).toBeGreaterThanOrEqual(200);
    const total = listCuisines("en").reduce((s, c) => s + c.recipeCount, 0);
    expect(total).toBe(CATALOG_RECIPE_COUNT);
    expect(cuisineStats("en").every((s) => s.avgCalories > 0 && s.avgCostPerServing > 0)).toBe(true);
  });

  it("localizes titles, cuisines, ingredients and steps", () => {
    const en = recipeDetail("koshari", "en")!;
    const ar = recipeDetail("koshari", "ar")!;
    expect(en.title).toBe("Koshari");
    expect(ar.title).not.toBe(en.title);
    expect(ar.cuisine.name).not.toBe(en.cuisine.name);
    expect(ar.ingredients).toHaveLength(en.ingredients.length);
    expect(ar.ingredients[0].name).not.toBe(en.ingredients[0].name);
    expect(ar.steps[0].instruction).not.toBe(en.steps[0].instruction);
    expect(en.ingredients.every((i) => i.name.length > 0)).toBe(true);
  });

  it("returns nothing for unknown recipes", () => {
    expect(recipeDetail("no-such-recipe", "en")).toBeNull();
    expect(shoppingList("no-such-recipe", 2, undefined, "en")).toBeNull();
  });

  it("applies list filters and sorting like the server", () => {
    const veg = listRecipes({ tag: "vegetarian", cuisine: "egyptian" });
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((r) => r.tags.includes("VEGETARIAN") && r.cuisine.slug === "egyptian")).toBe(true);

    const cheap = listRecipes({ maxCost: 20, sort: "cost" });
    expect(cheap.every((r) => r.costPerServing <= 20)).toBe(true);
    for (let i = 1; i < cheap.length; i++) expect(cheap[i].costPerServing).toBeGreaterThanOrEqual(cheap[i - 1].costPerServing);

    const protein = listRecipes({ minProtein: "30", sort: "protein" });
    expect(protein.every((r) => r.proteinPerServing >= 30)).toBe(true);
  });

  it("searches titles and ingredient names in both languages", () => {
    expect(listRecipes({ q: "lentil" }).length).toBeGreaterThan(0);
    expect(listRecipes({ q: "عدس" }).map((r) => r.slug)).toEqual(listRecipes({ q: "lentil" }).map((r) => r.slug));
  });

  it("filters by ingredient ids from the bundled ingredient list", () => {
    const rice = listIngredients("en").find((i) => i.name === "Rice")!;
    const withRice = listRecipes({ ingredients: rice.id });
    expect(withRice.length).toBeGreaterThan(0);
    expect(withRice.some((r) => r.slug === "koshari")).toBe(true);
  });

  it("makes seeded random picks repeatable", () => {
    const a = randomRecipe({ seed: "2026-10-19" });
    expect(a).toEqual(randomRecipe({ seed: "2026-10-19" }));
    expect(randomRecipe({ cuisine: "no-such-cuisine" })).toBeNull();
  });

  it("ranks pantry matches by the share of ingredients you have", () => {
    const ids = recipeDetail("koshari", "en")!.ingredients.length;
    const koshariIds = listIngredients("en")
      .filter((i) => recipeDetail("koshari", "en")!.ingredients.some((ing) => ing.name === i.name))
      .map((i) => i.id);
    expect(koshariIds).toHaveLength(ids);
    const matches = pantryMatch(koshariIds, "en");
    expect(matches[0].slug).toBe("koshari");
    expect(matches[0].missingIngredientNames).toEqual([]);
  });

  it("scales and prices shopping lists against a budget", () => {
    const four = shoppingList("koshari", 4, undefined, "en")!;
    const eight = shoppingList("koshari", 8, 1, "en")!;
    expect(eight.totalEstimatedCost).toBeCloseTo(four.totalEstimatedCost * 2, 0);
    expect(eight.withinBudget).toBe(false);
    expect(eight.budgetDifference).toBeLessThan(0);
    expect(four.deliveryPartners.length).toBeGreaterThan(0);
  });

  it("routes catalog requests and leaves account requests to the server", () => {
    expect((answerLocally("get", "/recipes", { lang: "ar" }, undefined) as RecipeSummary[]).length).toBe(CATALOG_RECIPE_COUNT);
    expect((answerLocally("GET", "/recipes/koshari", { lang: "en" }, undefined) as RecipeDetail).slug).toBe("koshari");
    expect(answerLocally("post", "/recipes/koshari/shopping-list", {}, JSON.stringify({ servings: 2 }))).toBeTruthy();
    expect(answerLocally("get", "/recipes/trending", {}, undefined)).toEqual([]);
    expect(answerLocally("get", "/favorites", {}, undefined)).toBeUndefined();
    expect(answerLocally("post", "/recipes/koshari/ratings", {}, "{}")).toBeUndefined();
    expect(answerLocally("get", "/auth/me", {}, undefined)).toBeUndefined();
    expect(answerLocally("get", "/recipes/no-such-recipe", {}, undefined)).toBeUndefined();
  });
});
