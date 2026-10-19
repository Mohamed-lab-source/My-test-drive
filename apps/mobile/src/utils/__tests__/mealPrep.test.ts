import { describe, expect, it } from "vitest";
import {
  buildMealPrepPlan,
  dailyTargetCalories,
  maintenanceCalories,
  mealKey,
  slotsFor,
  type MealPrepOptions,
} from "../mealPrep";
import type { RecipeSummary } from "../../api/types";

function recipe(slug: string, dishType: string, calories: number, cost: number, cuisine = "egyptian"): RecipeSummary {
  return {
    id: slug,
    slug,
    title: slug,
    description: "",
    dishType,
    heroImageUrl: "",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: "EASY",
    tags: [],
    occasions: [],
    avgRating: null,
    ratingCount: 0,
    costPerServing: cost,
    ingredientCount: 6,
    allergens: [],
    caloriesPerServing: calories,
    proteinPerServing: Math.round(calories / 25),
    fatPerServing: 15,
    cuisine: { slug: cuisine, name: cuisine },
  };
}

const catalog: RecipeSummary[] = [
  recipe("ful", "Breakfast", 420, 12),
  recipe("shakshuka", "Breakfast", 380, 18),
  recipe("eggah", "Breakfast", 350, 15),
  recipe("koshari", "Main Course", 600, 15),
  recipe("molokhia", "Main Course", 520, 40),
  recipe("kofta", "Main Course", 650, 70),
  recipe("fattah", "Main Course", 750, 60),
  recipe("lentil-soup", "Soup", 320, 10),
  recipe("pasta", "Pasta", 580, 25, "italian"),
  recipe("baba-ganoush", "Appetizer", 200, 12),
  recipe("hummus", "Appetizer", 260, 10),
  recipe("basbousa", "Dessert", 450, 20),
];

const baseOpts: MealPrepOptions = {
  days: 7,
  maintenance: 2400,
  dailyTarget: 1900,
  deficit: true,
  mealsPerDay: 3,
  includeSnack: false,
  lovedCuisineSlugs: ["egyptian"],
  favoriteSlugs: [],
  excludedSlugs: [],
  pinned: {},
  weeklyBudget: null,
  freeDayIndex: null,
  cheat: null,
  seed: 1,
};

describe("calorie targets", () => {
  it("uses Mifflin-St Jeor with an activity multiplier", () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; x1.55 = 2759 -> 2760
    expect(maintenanceCalories({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate" })).toBe(2760);
  });

  it("subtracts 500 for a deficit but never goes below the floor", () => {
    expect(dailyTargetCalories(2400, "female", true)).toBe(1900);
    expect(dailyTargetCalories(1500, "female", true)).toBe(1200);
    expect(dailyTargetCalories(1800, "male", true)).toBe(1500);
    expect(dailyTargetCalories(2400, "male", false)).toBe(2400);
  });

  it("orders slots and slots the snack before dinner", () => {
    expect(slotsFor(3, false)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(slotsFor(2, true)).toEqual(["lunch", "snack", "dinner"]);
  });
});

describe("buildMealPrepPlan", () => {
  it("plans every day near the calorie target without desserts in regular meals", () => {
    const plan = buildMealPrepPlan(catalog, baseOpts);
    expect(plan).not.toBeNull();
    expect(plan!.days).toHaveLength(7);
    for (const day of plan!.days) {
      expect(day.meals.map((m) => m.slot)).toEqual(["breakfast", "lunch", "dinner"]);
      expect(Math.abs(day.calories - 1900) / 1900).toBeLessThan(0.2);
      expect(day.meals.some((m) => m.recipe.dishType === "Dessert")).toBe(false);
    }
  });

  it("never uses excluded recipes and keeps pinned ones", () => {
    const plan = buildMealPrepPlan(catalog, {
      ...baseOpts,
      excludedSlugs: ["koshari"],
      pinned: { [mealKey(2, "dinner")]: "pasta" },
    });
    const all = plan!.days.flatMap((d) => d.meals);
    expect(all.some((m) => m.recipe.slug === "koshari")).toBe(false);
    const day2Dinner = plan!.days[2].meals.find((m) => m.slot === "dinner");
    expect(day2Dinner?.recipe.slug).toBe("pasta");
  });

  it("leaves the free day empty", () => {
    const plan = buildMealPrepPlan(catalog, { ...baseOpts, freeDayIndex: 6 });
    expect(plan!.days[6].isFree).toBe(true);
    expect(plan!.days[6].meals).toHaveLength(0);
  });
});
