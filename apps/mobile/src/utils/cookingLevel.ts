/** One level per 5 recipes cooked, starting at level 1 -- ties progression directly to the core cooking loop. */
const RECIPES_PER_LEVEL = 5;

export function cookingLevelFor(totalCooked: number): number {
  return 1 + Math.floor(totalCooked / RECIPES_PER_LEVEL);
}
