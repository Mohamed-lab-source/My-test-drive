import { describe, expect, it } from "vitest";
import { ingredientMaster } from "./ingredients";
import { cuisines } from "./cuisines";
import { allRecipes } from "./recipes";

// The app's meal-prep pools, lunchbox and party planner key off these.
const DISH_TYPES = new Set([
  "Main Course", "Appetizer", "Dessert", "Soup", "Breakfast", "Side Dish", "Pasta",
  "Beverage", "Rice", "Stir-fry", "Salad", "Bread", "Noodles", "Pizza",
]);
const UNITS = new Set(["g", "ml", "pcs", "tsp", "tbsp", "cup", "kg", "l"]);
const ARABIC = /[؀-ۿ]/;

describe("seed data", () => {
  const ingredientNames = new Set(ingredientMaster.map((i) => i.name));
  const cuisineSlugs = new Set(cuisines.map((c) => c.slug));

  it("has unique ingredient names with Arabic names, prices and nutrition", () => {
    expect(ingredientNames.size).toBe(ingredientMaster.length);
    for (const i of ingredientMaster) {
      expect(ARABIC.test(i.nameAr), i.name).toBe(true);
      expect(i.pricePerUnit, i.name).toBeGreaterThanOrEqual(0);
      expect(i.nutrition.kcal, i.name).toBeGreaterThanOrEqual(0);
      for (const target of Object.values(i.goalSubstitutes ?? {})) expect(ingredientNames.has(target), `${i.name} -> ${target}`).toBe(true);
    }
  });

  it("has unique slugs and titles in both languages", () => {
    const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    expect(dupes(allRecipes.map((r) => r.slug))).toEqual([]);
    expect(dupes(allRecipes.map((r) => r.title.toLowerCase()))).toEqual([]);
    expect(dupes(allRecipes.map((r) => r.titleAr))).toEqual([]);
  });

  it("gives every recipe valid, bilingual, complete data", () => {
    const problems: string[] = [];
    for (const r of allRecipes) {
      const p = (msg: string) => problems.push(`${r.slug}: ${msg}`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) p("bad slug");
      if (!cuisineSlugs.has(r.cuisine)) p(`unknown cuisine ${r.cuisine}`);
      if (!DISH_TYPES.has(r.dishType)) p(`unknown dish type ${r.dishType}`);
      if (!ARABIC.test(r.titleAr) || !ARABIC.test(r.descriptionAr)) p("missing Arabic title/description");
      if (r.baseServings < 1 || r.prepMinutes < 0 || r.cookMinutes < 0) p("bad servings/times");
      if (r.ingredients.length < 2) p("too few ingredients");
      if (r.steps.length < 2) p("too few steps");
      for (const ing of r.ingredients) {
        if (!ingredientNames.has(ing.name)) p(`unknown ingredient "${ing.name}"`);
        if (!(ing.quantity > 0)) p(`bad quantity for ${ing.name}`);
        if (!UNITS.has(ing.displayUnit)) p(`bad unit ${ing.displayUnit} for ${ing.name}`);
      }
      const names = r.ingredients.map((i) => i.name);
      if (new Set(names).size !== names.length) p("ingredient listed twice");
      for (const s of r.steps) {
        if (s.instruction.trim().length < 8) p("step too short");
        if (!ARABIC.test(s.instructionAr)) p("step missing Arabic");
        if (s.timerMinutes != null && !(s.timerMinutes > 0 && s.timerMinutes <= 600)) p("bad timer");
      }
    }
    expect(problems).toEqual([]);
  });
});
