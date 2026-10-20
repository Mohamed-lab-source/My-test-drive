import type { RecipeDetail, RecipeSummary } from "../api/types";

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
export const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active"];
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export type BodyStats = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
};

/** ~0.5 kg/week of fat loss, the commonly recommended sustainable pace. */
export const DEFICIT_KCAL = 500;
/** Floors below which a self-guided deficit isn't advisable. */
const MIN_DAILY_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };
export const KCAL_PER_KG_FAT = 7700;

/** Mifflin-St Jeor BMR times an activity multiplier, rounded to the nearest 10. */
export function maintenanceCalories(s: BodyStats): number {
  const bmr = 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age + (s.sex === "male" ? 5 : -161);
  return Math.round((bmr * ACTIVITY_MULTIPLIER[s.activity]) / 10) * 10;
}

export function dailyTargetCalories(maintenance: number, sex: Sex, deficit: boolean): number {
  if (!deficit) return maintenance;
  return Math.max(maintenance - DEFICIT_KCAL, MIN_DAILY_KCAL[sex]);
}

/** The ordered meal slots for a day, given how many main meals and whether to add a snack. */
export function slotsFor(mealsPerDay: 2 | 3, includeSnack: boolean): MealSlot[] {
  const base: MealSlot[] = mealsPerDay === 3 ? ["breakfast", "lunch", "dinner"] : ["lunch", "dinner"];
  return includeSnack ? [...base.slice(0, -1), "snack", base[base.length - 1]] : base;
}

/** Each slot's share of the daily calorie target; a snack takes 10% and the rest scale down. */
function slotShares(slots: MealSlot[]): Partial<Record<MealSlot, number>> {
  const base: Partial<Record<MealSlot, number>> = slots.includes("breakfast")
    ? { breakfast: 0.25, lunch: 0.4, dinner: 0.35 }
    : { lunch: 0.5, dinner: 0.5 };
  if (!slots.includes("snack")) return base;
  const scaled: Partial<Record<MealSlot, number>> = { snack: 0.1 };
  for (const [slot, share] of Object.entries(base)) scaled[slot as MealSlot] = share * 0.9;
  return scaled;
}

const BREAKFAST_TYPES = new Set(["Breakfast"]);
const MAIN_TYPES = new Set(["Main Course", "Pasta", "Soup", "Rice", "Stir-fry", "Salad", "Pizza", "Noodles"]);
const SNACK_TYPES = new Set(["Appetizer", "Side Dish"]);
const MIN_MEAL_KCAL = 150;
const MAX_MEAL_KCAL = 1500;
const MIN_SNACK_KCAL = 60;
const MAX_SNACK_KCAL = 450;
const MAX_CHEAT_KCAL = 2000;
const POOL_SIZE: Record<"breakfast" | "main" | "snack", number> = { breakfast: 2, main: 4, snack: 2 };
/** Each pass weighs cost harder until the week fits the budget. */
const COST_WEIGHTS = [1, 3, 6, 12, 25];

export function mealKey(dayIndex: number, slot: MealSlot): string {
  return `${dayIndex}-${slot}`;
}

export type MealPrepOptions = {
  days: number;
  maintenance: number;
  dailyTarget: number;
  deficit: boolean;
  mealsPerDay: 2 | 3;
  includeSnack: boolean;
  lovedCuisineSlugs: string[];
  favoriteSlugs: string[];
  excludedSlugs: string[];
  /** mealKey -> recipe slug the user locked or swapped in; kept through reshuffles. */
  pinned: Record<string, string>;
  weeklyBudget: number | null;
  freeDayIndex: number | null;
  cheat: { dayIndex: number; slot: MealSlot } | null;
  /** Changing the seed reshuffles near-tied picks, so "regenerate" gives a different week. */
  seed: number;
};

export type PlannedMeal = {
  slot: MealSlot;
  recipe: RecipeSummary;
  portions: number;
  calories: number;
  protein: number;
  fat: number;
  cost: number;
  isCheat: boolean;
  isPinned: boolean;
};

export type PlannedDay = {
  index: number;
  isFree: boolean;
  meals: PlannedMeal[];
  calories: number;
  protein: number;
  cost: number;
};

export type PrepItem = { recipe: RecipeSummary; portions: number; minutes: number };

export type MealPrepPlan = {
  days: PlannedDay[];
  /** In cook order: longest-cooking first, so it can simmer while the quicker ones get made. */
  prepList: PrepItem[];
  totalPrepMinutes: number;
  weeklyCost: number;
  avgDailyCalories: number;
  avgDailyProtein: number;
  /** Positive = deficit. The free day is assumed to land at maintenance. */
  weeklyDeficit: number;
  withinBudget: boolean | null;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // FNV alone barely moves the high bits when only the last character
  // changes (i.e. the seed), so finish with murmur3's avalanche step.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Nearest quarter-portion that hits the target, kept between half and double a serving. */
function portionsFor(kcal: number, target: number): number {
  return Math.min(2, Math.max(0.5, Math.round((target / kcal) * 4) / 4));
}

type Ctx = {
  opts: MealPrepOptions;
  loved: Set<string>;
  favorites: Set<string>;
  perMealBudget: number | null;
};

function makeCtx(opts: MealPrepOptions): Ctx {
  const activeDays = opts.days - (opts.freeDayIndex != null ? 1 : 0);
  const mealsPerActiveDay = slotsFor(opts.mealsPerDay, opts.includeSnack).length;
  return {
    opts,
    loved: new Set(opts.lovedCuisineSlugs),
    favorites: new Set(opts.favoriteSlugs),
    perMealBudget:
      opts.weeklyBudget != null && activeDays > 0 ? opts.weeklyBudget / (activeDays * mealsPerActiveDay) : null,
  };
}

function lovedBonus(r: RecipeSummary, ctx: Ctx): number {
  if (ctx.favorites.has(r.slug)) return 3;
  if (ctx.loved.has(r.cuisine.slug)) return 2;
  return 0;
}

function score(r: RecipeSummary, target: number, ctx: Ctx, costWeight: number, salt = ""): number {
  const fit = -1.5 * (Math.abs(r.caloriesPerServing - target) / target);
  const protein = ctx.opts.deficit ? 0.15 * ((r.proteinPerServing / r.caloriesPerServing) * 100) : 0;
  const rating = ((r.avgRating ?? 3.5) / 5) * 0.5;
  const cost =
    ctx.perMealBudget != null
      ? -costWeight * ((r.costPerServing * portionsFor(r.caloriesPerServing, target)) / ctx.perMealBudget)
      : 0;
  const jitter = hash(`${r.slug}:${ctx.opts.seed}${salt}`) * 1.2;
  return fit + protein + rating + cost + lovedBonus(r, ctx) + jitter;
}

/** Greedy pick of `count` distinct recipes, nudged toward cuisine variety. */
function pickSet(pool: RecipeSummary[], count: number, target: number, ctx: Ctx, costWeight: number) {
  const chosen: RecipeSummary[] = [];
  const remaining = [...pool];
  while (chosen.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    remaining.forEach((r, i) => {
      const sameCuisine = chosen.filter((c) => c.cuisine.slug === r.cuisine.slug).length;
      const s = score(r, target, ctx, costWeight) - 0.5 * sameCuisine;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    });
    chosen.push(remaining.splice(bestIdx, 1)[0]);
  }
  return chosen;
}

type Pools = { breakfast: RecipeSummary[]; main: RecipeSummary[]; snack: RecipeSummary[] };

function buildPools(recipes: RecipeSummary[], excluded: Set<string>): Pools {
  const usable = recipes.filter((r) => !excluded.has(r.slug) && !r.tags.includes("DESSERT"));
  const regular = usable.filter((r) => r.caloriesPerServing >= MIN_MEAL_KCAL && r.caloriesPerServing <= MAX_MEAL_KCAL);
  return {
    breakfast: regular.filter((r) => BREAKFAST_TYPES.has(r.dishType) || r.occasions.includes("RAMADAN_SUHOOR")),
    main: regular.filter((r) => MAIN_TYPES.has(r.dishType)),
    snack: usable.filter(
      (r) =>
        SNACK_TYPES.has(r.dishType) && r.caloriesPerServing >= MIN_SNACK_KCAL && r.caloriesPerServing <= MAX_SNACK_KCAL
    ),
  };
}

function poolKey(slot: MealSlot): keyof Pools {
  return slot === "breakfast" ? "breakfast" : slot === "snack" ? "snack" : "main";
}

function pickCheat(recipes: RecipeSummary[], slot: MealSlot, ctx: Ctx, excluded: Set<string>): RecipeSummary | null {
  const usable = recipes.filter((r) => !excluded.has(r.slug));
  const indulgent = usable.filter((r) => {
    if (r.caloriesPerServing < 300 || r.caloriesPerServing > MAX_CHEAT_KCAL) return false;
    if (slot === "breakfast") return BREAKFAST_TYPES.has(r.dishType) || r.tags.includes("DESSERT");
    if (slot === "snack") return r.tags.includes("DESSERT");
    return r.tags.includes("COMFORT") || r.dishType === "Pizza" || r.dishType === "Pasta";
  });
  const pool = indulgent.length > 0 ? indulgent : usable;
  let best: RecipeSummary | null = null;
  let bestScore = -Infinity;
  for (const r of pool) {
    const indulgence = Math.min(r.caloriesPerServing / 600, 2);
    const s =
      lovedBonus(r, ctx) + ((r.avgRating ?? 3.5) / 5) * 2 + indulgence + hash(`cheat:${r.slug}:${ctx.opts.seed}`);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function buildOnce(recipes: RecipeSummary[], ctx: Ctx, costWeight: number): MealPrepPlan | null {
  const { opts } = ctx;
  const slots = slotsFor(opts.mealsPerDay, opts.includeSnack);
  const shares = slotShares(slots);
  const excluded = new Set(opts.excludedSlugs);
  const pools = buildPools(recipes, excluded);
  const bySlug = new Map(recipes.map((r) => [r.slug, r]));
  if (pools.main.length === 0) return null;
  if (slots.includes("breakfast") && pools.breakfast.length === 0) return null;

  const target = (slot: MealSlot) => opts.dailyTarget * (shares[slot] ?? 0);
  const mainTarget = (target("lunch") + target("dinner")) / 2;
  const sets: Pools = {
    breakfast: slots.includes("breakfast")
      ? pickSet(pools.breakfast, POOL_SIZE.breakfast, target("breakfast"), ctx, costWeight)
      : [],
    main: pickSet(pools.main, POOL_SIZE.main, mainTarget, ctx, costWeight),
    snack: slots.includes("snack") ? pickSet(pools.snack, POOL_SIZE.snack, target("snack"), ctx, costWeight) : [],
  };

  const cheat =
    opts.cheat && opts.cheat.dayIndex !== opts.freeDayIndex && slots.includes(opts.cheat.slot) ? opts.cheat : null;
  const cheatRecipe = cheat ? pickCheat(recipes, cheat.slot, ctx, excluded) : null;

  const days: PlannedDay[] = [];
  let activeIdx = 0;
  for (let index = 0; index < opts.days; index++) {
    if (index === opts.freeDayIndex) {
      days.push({ index, isFree: true, meals: [], calories: 0, protein: 0, cost: 0 });
      continue;
    }
    const meals: PlannedMeal[] = [];
    for (const slot of slots) {
      const isCheat = !!cheat && cheat.dayIndex === index && cheat.slot === slot;
      const pinnedSlug = opts.pinned[mealKey(index, slot)];
      const pinnedRecipe = pinnedSlug && !excluded.has(pinnedSlug) ? bySlug.get(pinnedSlug) : undefined;
      const set = sets[poolKey(slot)];
      const rotated: RecipeSummary | undefined =
        slot === "lunch" || slot === "dinner"
          ? set[(activeIdx * 2 + (slot === "lunch" ? 0 : 1)) % set.length]
          : set[activeIdx % Math.max(set.length, 1)];
      const recipe = pinnedRecipe ?? (isCheat ? (cheatRecipe ?? rotated) : rotated);
      if (!recipe) continue;
      const portions = isCheat ? 1 : portionsFor(recipe.caloriesPerServing, target(slot));
      meals.push({
        slot,
        recipe,
        portions,
        calories: Math.round(recipe.caloriesPerServing * portions),
        protein: Math.round(recipe.proteinPerServing * portions),
        fat: Math.round(recipe.fatPerServing * portions),
        cost: round1(recipe.costPerServing * portions),
        isCheat,
        isPinned: !!pinnedRecipe,
      });
    }
    days.push({
      index,
      isFree: false,
      meals,
      calories: meals.reduce((sum, m) => sum + m.calories, 0),
      protein: meals.reduce((sum, m) => sum + m.protein, 0),
      cost: round1(meals.reduce((sum, m) => sum + m.cost, 0)),
    });
    activeIdx++;
  }

  const prep = new Map<string, PrepItem>();
  for (const day of days) {
    for (const meal of day.meals) {
      if (meal.isCheat) continue;
      const existing = prep.get(meal.recipe.slug);
      if (existing) existing.portions += meal.portions;
      else
        prep.set(meal.recipe.slug, {
          recipe: meal.recipe,
          portions: meal.portions,
          minutes: meal.recipe.prepMinutes + meal.recipe.cookMinutes,
        });
    }
  }
  const prepList = [...prep.values()].sort((a, b) => b.minutes - a.minutes);

  const activeDays = days.filter((d) => !d.isFree);
  const weeklyCost = round1(days.reduce((sum, d) => sum + d.cost, 0));
  const avg = (pick: (d: PlannedDay) => number) =>
    activeDays.length ? Math.round(activeDays.reduce((sum, d) => sum + pick(d), 0) / activeDays.length) : 0;
  return {
    days,
    prepList,
    totalPrepMinutes: prepList.reduce((sum, p) => sum + p.minutes, 0),
    weeklyCost,
    avgDailyCalories: avg((d) => d.calories),
    avgDailyProtein: avg((d) => d.protein),
    weeklyDeficit: activeDays.reduce((sum, d) => sum + (opts.maintenance - d.calories), 0),
    withinBudget: opts.weeklyBudget != null ? weeklyCost <= opts.weeklyBudget : null,
  };
}

/**
 * Builds a meal-prep week from a small rotating set of recipes (2 breakfasts,
 * 4 lunch/dinner mains, 2 snacks) so each can be batch-cooked, with portion
 * sizes scaled so every meal lands near its share of the daily calorie target.
 * Loved cuisines and favorites are preferred, excluded recipes never appear,
 * and pinned meals stay put. When a budget is set, cost is weighed
 * progressively harder until the week fits it.
 */
export function buildMealPrepPlan(recipes: RecipeSummary[], opts: MealPrepOptions): MealPrepPlan | null {
  const ctx = makeCtx(opts);
  let plan: MealPrepPlan | null = null;
  for (const weight of ctx.perMealBudget != null ? COST_WEIGHTS : [0]) {
    plan = buildOnce(recipes, ctx, weight);
    if (!plan || plan.withinBudget !== false) return plan;
  }
  return plan;
}

/**
 * Next-best alternative for one meal slot, skipping the current recipe and
 * anything already eaten that day. `nonce` lets repeated swaps walk through
 * different alternatives instead of bouncing between two.
 */
export function suggestSwap(
  recipes: RecipeSummary[],
  opts: MealPrepOptions,
  slot: MealSlot,
  avoidSlugs: string[],
  nonce: number
): RecipeSummary | null {
  const ctx = makeCtx(opts);
  const shares = slotShares(slotsFor(opts.mealsPerDay, opts.includeSnack));
  const target = opts.dailyTarget * (shares[slot] ?? 0.3);
  const avoid = new Set(avoidSlugs);
  const pool = buildPools(recipes, new Set(opts.excludedSlugs))[poolKey(slot)].filter((r) => !avoid.has(r.slug));
  let best: RecipeSummary | null = null;
  let bestScore = -Infinity;
  for (const r of pool) {
    const s = score(r, target, ctx, ctx.perMealBudget != null ? 1 : 0, `:swap${nonce}`);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

export type AggregatedIngredient = { name: string; quantity: number; unit: string; category: string };

/** Totals every ingredient across the prep list, scaled from each recipe's base servings to the planned portions. */
export function aggregatePrepIngredients(details: RecipeDetail[], prepList: PrepItem[]): AggregatedIngredient[] {
  const bySlug = new Map(details.map((d) => [d.slug, d]));
  const totals = new Map<string, AggregatedIngredient>();
  for (const item of prepList) {
    const detail = bySlug.get(item.recipe.slug);
    if (!detail) continue;
    const factor = item.portions / detail.baseServings;
    for (const ing of detail.ingredients) {
      const key = `${ing.name}|${ing.unit}`;
      const qty = ing.quantity * factor;
      const existing = totals.get(key);
      if (existing) existing.quantity += qty;
      else totals.set(key, { name: ing.name, quantity: qty, unit: ing.unit, category: ing.category });
    }
  }
  return [...totals.values()]
    .map((i) => ({ ...i, quantity: i.quantity >= 10 ? Math.round(i.quantity) : Math.round(i.quantity * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
