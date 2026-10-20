import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import type { Allergen } from "../api/types";

/** The current user's allergen list, whether signed in (server preference) or a guest (local preference). */
export function useMyAllergies(): Allergen[] {
  const { isAuthenticated, user } = useAuth();
  const { preference } = useLocalPreference();
  return isAuthenticated ? user?.preference?.allergies ?? [] : preference.allergies;
}

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
