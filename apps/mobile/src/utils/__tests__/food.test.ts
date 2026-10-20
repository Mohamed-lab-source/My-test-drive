import { describe, expect, it } from "vitest";
import { nutritionBadges } from "../recipeBadges";
import { isKidFriendly, isLunchboxFriendly } from "../kidFriendly";
import { convertWithDensity } from "../densityConvert";
import { frequentFoods } from "../diaryHelpers";
import { fastingStats } from "../fasting";
import { inSeason } from "../../data/seasonalProduce";
import { DENSITIES } from "../../data/densities";
import type { RecipeSummary } from "../../api/types";

function recipe(overrides: Partial<RecipeSummary>): RecipeSummary {
  return {
    id: "1",
    slug: "r",
    title: "R",
    description: "",
    dishType: "Main Course",
    heroImageUrl: "",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: "EASY",
    tags: [],
    occasions: [],
    avgRating: null,
    ratingCount: 0,
    costPerServing: 30,
    ingredientCount: 6,
    allergens: [],
    caloriesPerServing: 450,
    proteinPerServing: 20,
    fatPerServing: 15,
    cuisine: { slug: "egyptian", name: "Egyptian" },
    ...overrides,
  };
}

describe("nutrition badges", () => {
  it("flags high protein and low calorie independently", () => {
    expect(nutritionBadges(350, 30).map((b) => b.key)).toEqual(["highProtein", "lowCalorie"]);
    expect(nutritionBadges(700, 10)).toEqual([]);
    expect(nutritionBadges(0, 5)).toEqual([]);
  });
});

describe("kid-friendly and lunchbox filters", () => {
  it("rules out spicy, hard or long recipes", () => {
    expect(isKidFriendly(recipe({}))).toBe(true);
    expect(isKidFriendly(recipe({ tags: ["SPICY"] }))).toBe(false);
    expect(isKidFriendly(recipe({ difficulty: "HARD" }))).toBe(false);
    expect(isKidFriendly(recipe({ cookMinutes: 90 }))).toBe(false);
  });

  it("keeps lunchboxes quick, portable and moderate", () => {
    expect(isLunchboxFriendly(recipe({ dishType: "Appetizer" }))).toBe(true);
    expect(isLunchboxFriendly(recipe({ dishType: "Soup" }))).toBe(false);
    expect(isLunchboxFriendly(recipe({ caloriesPerServing: 900 }))).toBe(false);
    expect(isLunchboxFriendly(recipe({ cookMinutes: 35 }))).toBe(false);
  });
});

describe("cup and gram conversion", () => {
  it("turns volumes into grams for the ingredient", () => {
    expect(convertWithDensity(1, "cup", 125)?.grams).toBe(125);
    expect(convertWithDensity(2, "tbsp", 200)?.grams).toBe(25);
  });

  it("turns grams into cups and tablespoons", () => {
    expect(convertWithDensity(250, "g", 125)).toEqual({ grams: 250, cups: 2, tbsp: 32 });
  });

  it("rejects bad input", () => {
    expect(convertWithDensity(Number.NaN, "cup", 125)).toBeNull();
    expect(convertWithDensity(-1, "cup", 125)).toBeNull();
  });

  it("has a positive density for every ingredient", () => {
    expect(DENSITIES.every((d) => d.gramsPerCup > 0 && d.en && d.ar)).toBe(true);
  });
});

describe("frequent foods", () => {
  const entry = (title: string, date: string, createdAt: number, calories = 100) => ({ title, date, createdAt, calories });

  it("ranks by count, ignores case and old entries, and keeps the latest version", () => {
    const entries = [
      entry("Ful", "2026-10-18", 1, 300),
      entry("ful ", "2026-10-19", 5, 320),
      entry("Koshari", "2026-10-19", 4),
      entry("Ful", "2026-08-01", 0),
      entry("Ful", "2026-08-02", 0),
    ];
    const top = frequentFoods(entries, "2026-09-19");
    expect(top.map((e) => e.title)).toEqual(["ful ", "Koshari"]);
    expect(top[0].calories).toBe(320);
  });
});

describe("fasting stats", () => {
  const h = 3600000;
  const now = new Date(2026, 9, 19, 12).getTime();
  const endedOn = (day: number, hours: number, goal = 16) => {
    const end = new Date(2026, 9, day, 10).getTime();
    return { start: end - hours * h, end, goalHours: goal };
  };

  it("counts completed fasts and a streak of consecutive goal days", () => {
    const stats = fastingStats([endedOn(19, 16), endedOn(18, 17), endedOn(17, 12), endedOn(16, 16)], now);
    expect(stats.completed).toBe(3);
    expect(stats.streakDays).toBe(2);
    expect(stats.longestHours).toBe(17);
  });

  it("is empty with no history", () => {
    expect(fastingStats([], now)).toEqual({ completed: 0, longestHours: 0, averageHours: 0, streakDays: 0 });
  });
});

describe("seasonal produce", () => {
  it("has produce for every month with names in both languages", () => {
    for (let m = 0; m < 12; m++) {
      const list = inSeason(m);
      expect(list.length).toBeGreaterThan(5);
      expect(list.every((p) => p.en && p.ar && p.emoji)).toBe(true);
    }
  });
});
