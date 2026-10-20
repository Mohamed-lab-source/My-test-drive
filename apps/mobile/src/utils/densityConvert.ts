export type DensityUnit = "cup" | "tbsp" | "tsp" | "g";

const CUP_FRACTION: Record<Exclude<DensityUnit, "g">, number> = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 };

/**
 * Converts between volume and weight for one ingredient. Volume input gives
 * grams; gram input gives cups (plus tablespoons for small amounts).
 */
export function convertWithDensity(
  amount: number,
  unit: DensityUnit,
  gramsPerCup: number
): { grams: number; cups: number; tbsp: number } | null {
  if (!Number.isFinite(amount) || amount < 0 || gramsPerCup <= 0) return null;
  const cups = unit === "g" ? amount / gramsPerCup : amount * CUP_FRACTION[unit];
  const grams = unit === "g" ? amount : cups * gramsPerCup;
  return { grams: Math.round(grams), cups: Math.round(cups * 100) / 100, tbsp: Math.round(cups * 16 * 10) / 10 };
}
