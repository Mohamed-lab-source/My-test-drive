import { describe, expect, it } from "vitest";
import { applyNumericFilters, computeCuisineStats, sortSummaries, type SummaryLike } from "./recipeFilters";

function recipe(overrides: Partial<SummaryLike> & { slug: string }): SummaryLike {
  return {
    title: overrides.slug,
    prepMinutes: 10,
    cookMinutes: 20,
    costPerServing: 30,
    caloriesPerServing: 400,
    proteinPerServing: 20,
    avgRating: null,
    tags: [],
    cuisine: { slug: "egyptian", name: "Egyptian" },
    ...overrides,
  };
}

const koshari = recipe({ slug: "koshari", costPerServing: 15, caloriesPerServing: 550, proteinPerServing: 18, tags: ["VEGETARIAN"] });
const kofta = recipe({ slug: "kofta", costPerServing: 70, caloriesPerServing: 480, proteinPerServing: 35, avgRating: 4.5, cookMinutes: 15 });
const salad = recipe({
  slug: "salad",
  costPerServing: 20,
  caloriesPerServing: 180,
  proteinPerServing: 5,
  avgRating: 3.9,
  prepMinutes: 10,
  cookMinutes: 0,
  tags: ["QUICK", "VEGETARIAN"],
  cuisine: { slug: "greek", name: "Greek" },
});

describe("applyNumericFilters", () => {
  it("applies every bound together", () => {
    const out = applyNumericFilters([koshari, kofta, salad], { maxCalories: 500, minProtein: 10 });
    expect(out.map((r) => r.slug)).toEqual(["kofta"]);
  });

  it("filters on cost and total minutes", () => {
    expect(applyNumericFilters([koshari, kofta, salad], { maxCost: 25 }).map((r) => r.slug)).toEqual(["koshari", "salad"]);
    expect(applyNumericFilters([koshari, kofta, salad], { maxMinutes: 25 }).map((r) => r.slug)).toEqual(["kofta", "salad"]);
  });

  it("returns everything when no bounds are set", () => {
    expect(applyNumericFilters([koshari, kofta], {})).toHaveLength(2);
  });
});

describe("sortSummaries", () => {
  it("sorts cheapest and most protein first", () => {
    expect(sortSummaries([kofta, koshari, salad], "cost").map((r) => r.slug)).toEqual(["koshari", "salad", "kofta"]);
    expect(sortSummaries([koshari, salad, kofta], "protein").map((r) => r.slug)).toEqual(["kofta", "koshari", "salad"]);
  });

  it("puts unrated recipes last when sorting by rating", () => {
    expect(sortSummaries([koshari, salad, kofta], "rating").map((r) => r.slug)).toEqual(["kofta", "salad", "koshari"]);
  });

  it("does not mutate its input", () => {
    const input = [kofta, koshari];
    sortSummaries(input, "cost");
    expect(input.map((r) => r.slug)).toEqual(["kofta", "koshari"]);
  });
});

describe("computeCuisineStats", () => {
  it("averages per cuisine and orders by recipe count", () => {
    const stats = computeCuisineStats([koshari, kofta, salad]);
    expect(stats.map((s) => s.slug)).toEqual(["egyptian", "greek"]);
    expect(stats[0]).toMatchObject({ recipeCount: 2, avgCostPerServing: 42.5, avgCalories: 515, avgRating: 4.5, vegetarianCount: 1 });
    expect(stats[1]).toMatchObject({ recipeCount: 1, quickCount: 1, avgMinutes: 10 });
  });
});
