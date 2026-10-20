import type { RecipeSummary } from "../api/types";

const KID_MAX_MINUTES = 60;
const LUNCHBOX_MAX_MINUTES = 40;
const LUNCHBOX_MAX_KCAL = 650;
const LUNCHBOX_DISH_TYPES = ["Appetizer", "Breakfast", "Side Dish", "Pasta", "Rice", "Salad", "Bread", "Noodles", "Pizza", "Main Course"];

/** Mild, not fiddly, and on the table within the hour. */
export function isKidFriendly(r: RecipeSummary): boolean {
  return !r.tags.includes("SPICY") && r.difficulty !== "HARD" && r.prepMinutes + r.cookMinutes <= KID_MAX_MINUTES;
}

/** Kid-friendly dishes that travel: quick, moderate portions, and not soups, drinks or desserts. */
export function isLunchboxFriendly(r: RecipeSummary): boolean {
  return (
    isKidFriendly(r) &&
    LUNCHBOX_DISH_TYPES.includes(r.dishType) &&
    r.prepMinutes + r.cookMinutes <= LUNCHBOX_MAX_MINUTES &&
    r.caloriesPerServing > 0 &&
    r.caloriesPerServing <= LUNCHBOX_MAX_KCAL
  );
}
