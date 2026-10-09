import type { TranslationKey } from "../i18n/translations";
import type { DishTag } from "../api/types";

export type BeverageKey =
  | "karkade"
  | "ayran"
  | "arabicCoffee"
  | "moroccanMintTea"
  | "lassi"
  | "jasmineTea"
  | "limonata"
  | "mintLemonade";

const BEVERAGES: Record<BeverageKey, { emoji: string; nameKey: TranslationKey }> = {
  karkade: { emoji: "🌺", nameKey: "beverage.karkade" },
  ayran: { emoji: "🥛", nameKey: "beverage.ayran" },
  arabicCoffee: { emoji: "☕", nameKey: "beverage.arabicCoffee" },
  moroccanMintTea: { emoji: "🍵", nameKey: "beverage.moroccanMintTea" },
  lassi: { emoji: "🥭", nameKey: "beverage.lassi" },
  jasmineTea: { emoji: "🍵", nameKey: "beverage.jasmineTea" },
  limonata: { emoji: "🍋", nameKey: "beverage.limonata" },
  mintLemonade: { emoji: "🍋", nameKey: "beverage.mintLemonade" },
};

const BEVERAGE_BY_CUISINE: Record<string, BeverageKey> = {
  egyptian: "karkade",
  levantine: "ayran",
  turkish: "ayran",
  moroccan: "moroccanMintTea",
  indian: "lassi",
  asian: "jasmineTea",
  italian: "limonata",
  mediterranean: "limonata",
  french: "limonata",
  mexican: "mintLemonade",
  american: "mintLemonade",
};

/**
 * Picks one non-alcoholic drink to suggest alongside a recipe. Spicy and
 * dessert dishes override the cuisine default -- a cooling yogurt drink cuts
 * spice better than whatever that cuisine would normally serve, and Arabic
 * coffee is the default MENA dessert pairing regardless of cuisine.
 */
export function suggestBeverage(cuisineSlug: string, tags: DishTag[]): { emoji: string; nameKey: TranslationKey } {
  let key: BeverageKey;
  if (tags.includes("DESSERT")) {
    key = "arabicCoffee";
  } else if (tags.includes("SPICY")) {
    key = "ayran";
  } else {
    key = BEVERAGE_BY_CUISINE[cuisineSlug] ?? "mintLemonade";
  }
  return BEVERAGES[key];
}
