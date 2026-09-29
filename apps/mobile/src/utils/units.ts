export type UnitSystem = "metric" | "imperial";

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * Converts a metric quantity (as stored/scaled server-side) into a display
 * string for the given unit system. Uses standard conversion factors, not
 * ingredient-specific density — a reasonable approximation for a home cook,
 * not a precise volumetric conversion.
 */
export function formatQuantity(quantity: number, unit: string, system: UnitSystem): string {
  if (system === "metric" || unit === "pcs") {
    return `${quantity} ${unit}`;
  }
  if (unit === "g") {
    const oz = quantity * 0.035274;
    if (oz >= 16) return `${round1(oz / 16)} lb`;
    return `${round1(oz)} oz`;
  }
  if (unit === "ml") {
    if (quantity < 15) return `${round1(quantity / 4.92892)} tsp`;
    if (quantity < 237) return `${round1(quantity / 14.7868)} tbsp`;
    return `${round1(quantity / 236.588)} cup`;
  }
  return `${quantity} ${unit}`;
}
