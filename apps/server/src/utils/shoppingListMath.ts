export type PricedIngredient = {
  name: string;
  quantity: number;
  displayUnit: string;
  pricePerUnit: number;
};

export type ShoppingListItemResult = {
  ingredientName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
};

export type ShoppingListComputation = {
  items: ShoppingListItemResult[];
  totalEstimatedCost: number;
  withinBudget: boolean;
  budgetDifference: number | null;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Scales each ingredient from a recipe's base servings to the requested
 * servings and prices it, then totals the list against an optional budget.
 */
export function computeShoppingList(
  ingredients: PricedIngredient[],
  servings: number,
  baseServings: number,
  budget?: number
): ShoppingListComputation {
  const scale = servings / baseServings;

  const items = ingredients.map((ing) => {
    const quantity = round2(ing.quantity * scale);
    const estimatedCost = round2(quantity * ing.pricePerUnit);
    return {
      ingredientName: ing.name,
      quantity,
      unit: ing.displayUnit,
      estimatedCost,
    };
  });

  const totalEstimatedCost = round2(items.reduce((sum, i) => sum + i.estimatedCost, 0));
  const withinBudget = budget === undefined ? true : totalEstimatedCost <= budget;
  const budgetDifference = budget === undefined ? null : round2(budget - totalEstimatedCost);

  return { items, totalEstimatedCost, withinBudget, budgetDifference };
}
