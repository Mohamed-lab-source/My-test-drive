import type { TranslationKey } from "../i18n/translations";

export const HIGH_PROTEIN_GRAMS = 25;
export const LOW_CALORIE_KCAL = 400;

export type NutritionBadge = { key: "highProtein" | "lowCalorie"; labelKey: TranslationKey };

/** Per-serving badges shown on recipe cards and the detail screen. */
export function nutritionBadges(caloriesPerServing: number, proteinPerServing: number): NutritionBadge[] {
  const badges: NutritionBadge[] = [];
  if (proteinPerServing >= HIGH_PROTEIN_GRAMS) badges.push({ key: "highProtein", labelKey: "badge.highProtein" });
  if (caloriesPerServing > 0 && caloriesPerServing <= LOW_CALORIE_KCAL) {
    badges.push({ key: "lowCalorie", labelKey: "badge.lowCalorie" });
  }
  return badges;
}

/** "7:05 PM" / "7:05 م" -- formatted by hand because Hermes ships without full Intl time zones. */
export function formatClock(date: Date, locale: "en" | "ar"): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const suffix = locale === "ar" ? (hours < 12 ? "ص" : "م") : hours < 12 ? "AM" : "PM";
  return `${h12}:${minutes} ${suffix}`;
}

/** Whole days from a UTC YYYY-MM-DD key to today (UTC), never negative. */
export function daysSince(dateKey: string, now = new Date()): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - Date.UTC(y, m - 1, d)) / 86400000));
}
