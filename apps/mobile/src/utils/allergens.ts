import type { Allergen } from "../api/types";

export const ALL_ALLERGENS: Allergen[] = [
  "GLUTEN",
  "DAIRY",
  "EGGS",
  "NUTS",
  "PEANUTS",
  "SHELLFISH",
  "FISH",
  "SOY",
  "SESAME",
];

export function intersectAllergens(a: Allergen[], b: Allergen[]): Allergen[] {
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}
