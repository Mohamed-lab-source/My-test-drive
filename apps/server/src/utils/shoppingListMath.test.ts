import { describe, expect, it } from "vitest";
import { computeShoppingList } from "./shoppingListMath";

const koshariIngredients = [
  { name: "Rice", quantity: 300, displayUnit: "g", pricePerUnit: 0.035 },
  { name: "Olive Oil", quantity: 60, displayUnit: "ml", pricePerUnit: 0.25 },
];

describe("computeShoppingList", () => {
  it("scales quantities proportionally to servings", () => {
    const result = computeShoppingList(koshariIngredients, 8, 4);
    expect(result.items[0].quantity).toBe(600);
    expect(result.items[1].quantity).toBe(120);
  });

  it("leaves quantities unchanged when servings equal base servings", () => {
    const result = computeShoppingList(koshariIngredients, 4, 4);
    expect(result.items[0].quantity).toBe(300);
  });

  it("totals estimated cost across all items", () => {
    const result = computeShoppingList(koshariIngredients, 4, 4);
    // 300 * 0.035 + 60 * 0.25 = 10.5 + 15 = 25.5
    expect(result.totalEstimatedCost).toBe(25.5);
  });

  it("reports within budget when the total is at or under the budget", () => {
    const result = computeShoppingList(koshariIngredients, 4, 4, 25.5);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetDifference).toBe(0);
  });

  it("reports over budget with a negative difference", () => {
    const result = computeShoppingList(koshariIngredients, 4, 4, 10);
    expect(result.withinBudget).toBe(false);
    expect(result.budgetDifference).toBe(-15.5);
  });

  it("treats a missing budget as always within budget", () => {
    const result = computeShoppingList(koshariIngredients, 4, 4);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetDifference).toBeNull();
  });

  it("rounds quantities and costs to 2 decimal places", () => {
    const result = computeShoppingList(
      [{ name: "Saffron", quantity: 1, displayUnit: "g", pricePerUnit: 3.333 }],
      3,
      7
    );
    // scale = 3/7 = 0.42857..., quantity rounds to 0.43, cost = 0.43 * 3.333 rounds to 1.43
    expect(result.items[0].quantity).toBe(0.43);
    expect(result.items[0].estimatedCost).toBe(1.43);
  });
});
