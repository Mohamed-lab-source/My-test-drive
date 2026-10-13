import type { RecipeSummary } from "../api/types";

export type MealSlot = "breakfast" | "lunch" | "dinner";
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

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

const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.4, dinner: 0.35 };
const BREAKFAST_TYPES = new Set(["Breakfast"]);
const MAIN_TYPES = new Set(["Main Course", "Pasta", "Soup", "Rice", "Stir-fry", "Salad", "Pizza", "Noodles"]);
const MIN_MEAL_KCAL = 150;
const MAX_MEAL_KCAL = 1500;
const MAX_CHEAT_KCAL = 2000;
const BREAKFAST_RECIPES = 2;
const MAIN_RECIPES = 4;
/** Each pass weighs cost harder until the week fits the budget. */
const COST_WEIGHTS = [1, 3, 6, 12, 25];

export type MealPrepOptions = {
  days: number;
  maintenance: number;
  dailyTarget: number;
  deficit: boolean;
  lovedCuisineSlugs: string[];
  favoriteSlugs: string[];
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
  cost: number;
  isCheat: boolean;
};

export type PlannedDay = {
  index: number;
  isFree: boolean;
  meals: PlannedMeal[];
  calories: number;
  cost: number;
};

export type PrepItem = { recipe: RecipeSummary; portions: number };

export type MealPrepPlan = {
  days: PlannedDay[];
  prepList: PrepItem[];
  weeklyCost: number;
  avgDailyCalories: number;
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

function lovedBonus(r: RecipeSummary, ctx: Ctx): number {
  if (ctx.favorites.has(r.slug)) return 3;
  if (ctx.loved.has(r.cuisine.slug)) return 2;
  return 0;
}

function score(r: RecipeSummary, target: number, ctx: Ctx, costWeight: number): number {
  const fit = -1.5 * (Math.abs(r.caloriesPerServing - target) / target);
  const protein = ctx.opts.deficit ? 0.15 * ((r.proteinPerServing / r.caloriesPerServing) * 100) : 0;
  const rating = ((r.avgRating ?? 3.5) / 5) * 0.5;
  const cost =
    ctx.perMealBudget != null
      ? -costWeight * ((r.costPerServing * portionsFor(r.caloriesPerServing, target)) / ctx.perMealBudget)
      : 0;
  const jitter = hash(`${r.slug}:${ctx.opts.seed}`) * 1.2;
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

function isRegularMeal(r: RecipeSummary): boolean {
  return (
    !r.tags.includes("DESSERT") && r.caloriesPerServing >= MIN_MEAL_KCAL && r.caloriesPerServing <= MAX_MEAL_KCAL
  );
}

function pickCheat(recipes: RecipeSummary[], slot: MealSlot, ctx: Ctx): RecipeSummary | null {
  const indulgent = recipes.filter((r) => {
    if (r.caloriesPerServing < 300 || r.caloriesPerServing > MAX_CHEAT_KCAL) return false;
    if (slot === "breakfast") return BREAKFAST_TYPES.has(r.dishType) || r.tags.includes("DESSERT");
    return r.tags.includes("COMFORT") || r.dishType === "Pizza" || r.dishType === "Pasta";
  });
  const pool = indulgent.length > 0 ? indulgent : recipes;
  let best: RecipeSummary | null = null;
  let bestScore = -Infinity;
  for (const r of pool) {
    const s = lovedBonus(r, ctx) + ((r.avgRating ?? 3.5) / 5) * 2 + hash(`cheat:${r.slug}:${ctx.opts.seed}`);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function buildOnce(recipes: RecipeSummary[], ctx: Ctx, costWeight: number): MealPrepPlan | null {
  const { opts } = ctx;
  const regular = recipes.filter(isRegularMeal);
  const breakfastPool = regular.filter(
    (r) => BREAKFAST_TYPES.has(r.dishType) || r.occasions.includes("RAMADAN_SUHOOR")
  );
  const mainPool = regular.filter((r) => MAIN_TYPES.has(r.dishType));
  if (breakfastPool.length === 0 || mainPool.length === 0) return null;

  const breakfastTarget = opts.dailyTarget * SLOT_SHARE.breakfast;
  const mainTarget = (opts.dailyTarget * (SLOT_SHARE.lunch + SLOT_SHARE.dinner)) / 2;
  const breakfasts = pickSet(breakfastPool, BREAKFAST_RECIPES, breakfastTarget, ctx, costWeight);
  const mains = pickSet(mainPool, MAIN_RECIPES, mainTarget, ctx, costWeight);

  const cheat = opts.cheat && opts.cheat.dayIndex !== opts.freeDayIndex ? opts.cheat : null;
  const cheatRecipe = cheat ? pickCheat(recipes, cheat.slot, ctx) : null;

  const days: PlannedDay[] = [];
  let activeIdx = 0;
  for (let index = 0; index < opts.days; index++) {
    if (index === opts.freeDayIndex) {
      days.push({ index, isFree: true, meals: [], calories: 0, cost: 0 });
      continue;
    }
    const meals: PlannedMeal[] = MEAL_SLOTS.map((slot) => {
      const isCheat = !!cheat && !!cheatRecipe && cheat.dayIndex === index && cheat.slot === slot;
      const recipe = isCheat
        ? cheatRecipe!
        : slot === "breakfast"
          ? breakfasts[activeIdx % breakfasts.length]
          : mains[(activeIdx * 2 + (slot === "lunch" ? 0 : 1)) % mains.length];
      const portions = isCheat ? 1 : portionsFor(recipe.caloriesPerServing, opts.dailyTarget * SLOT_SHARE[slot]);
      return {
        slot,
        recipe,
        portions,
        calories: Math.round(recipe.caloriesPerServing * portions),
        cost: round1(recipe.costPerServing * portions),
        isCheat,
      };
    });
    days.push({
      index,
      isFree: false,
      meals,
      calories: meals.reduce((sum, m) => sum + m.calories, 0),
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
      else prep.set(meal.recipe.slug, { recipe: meal.recipe, portions: meal.portions });
    }
  }

  const activeDays = days.filter((d) => !d.isFree);
  const weeklyCost = round1(days.reduce((sum, d) => sum + d.cost, 0));
  return {
    days,
    prepList: [...prep.values()].sort((a, b) => b.portions - a.portions),
    weeklyCost,
    avgDailyCalories: activeDays.length
      ? Math.round(activeDays.reduce((sum, d) => sum + d.calories, 0) / activeDays.length)
      : 0,
    weeklyDeficit: activeDays.reduce((sum, d) => sum + (opts.maintenance - d.calories), 0),
    withinBudget: opts.weeklyBudget != null ? weeklyCost <= opts.weeklyBudget : null,
  };
}

/**
 * Builds a meal-prep week: 3 meals a day drawn from a small rotating set
 * (2 breakfasts, 4 lunch/dinner mains) so each recipe can be batch-cooked,
 * with portion sizes scaled so every meal lands near its share of the daily
 * calorie target. Loved cuisines and favorites are preferred; when a budget
 * is set, cost is weighed progressively harder until the week fits it.
 */
export function buildMealPrepPlan(recipes: RecipeSummary[], opts: MealPrepOptions): MealPrepPlan | null {
  const activeDays = opts.days - (opts.freeDayIndex != null ? 1 : 0);
  const ctx: Ctx = {
    opts,
    loved: new Set(opts.lovedCuisineSlugs),
    favorites: new Set(opts.favoriteSlugs),
    perMealBudget: opts.weeklyBudget != null && activeDays > 0 ? opts.weeklyBudget / (activeDays * 3) : null,
  };
  let plan: MealPrepPlan | null = null;
  for (const weight of ctx.perMealBudget != null ? COST_WEIGHTS : [0]) {
    plan = buildOnce(recipes, ctx, weight);
    if (!plan || plan.withinBudget !== false) return plan;
  }
  return plan;
}
