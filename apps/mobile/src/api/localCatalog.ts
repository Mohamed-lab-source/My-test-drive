import catalogJson from "../data/catalog.json";
import type {
  Allergen,
  Cuisine,
  CuisineStats,
  DeliveryPartner,
  Difficulty,
  DishTag,
  NutritionPerServing,
  Occasion,
  PantryIngredient,
  PantryMatch,
  RecipeDetail,
  RecipeSummary,
  ShoppingListResult,
} from "./types";

/**
 * The recipe catalog bundled into the app (exported from the server by
 * apps/server/scripts/exportCatalog.ts), answering the same catalog requests
 * the API does so the app keeps working when the server can't be reached.
 * Anything account-specific (ratings, reviews, synced lists) still needs the
 * server.
 */

type Lang = "en" | "ar";
type Bi<T = string> = { en: T; ar: T };

type CatalogRecipe = {
  slug: string;
  title: Bi;
  description: Bi;
  cuisineSlug: string;
  dishType: string;
  heroImageUrl: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  tags: DishTag[];
  occasions: Occasion[];
  costPerServing: number;
  ingredientCount: number;
  allergens: Allergen[];
  caloriesPerServing: number;
  proteinPerServing: number;
  fatPerServing: number;
  nutritionPerServing: NutritionPerServing;
  equipment: string[];
  ingredients: { id: string; quantity: number; unit: string; note: string | null }[];
  steps: { order: number; timerMinutes: number | null; imageUrl: string | null; instruction: Bi }[];
};

type CatalogIngredient = {
  id: string;
  name: Bi;
  category: string;
  substitute: Bi<string | null>;
  allergens: Allergen[];
  pricePerUnit: number;
};

type Catalog = {
  generatedAt: string;
  cuisines: { slug: string; name: Bi }[];
  ingredients: CatalogIngredient[];
  deliveryPartners: DeliveryPartner[];
  recipes: CatalogRecipe[];
};

/**
 * On-disk form written by exportCatalog.ts. With thousands of recipes the
 * plain shape above is several MB, so fields that can be rebuilt are left
 * out: ingredient lines are [ingredient index, quantity, note?] (the unit is
 * the ingredient's own), steps are [en, ar, timer?], derived numbers come
 * from nutritionPerServing, empty lists are omitted, and step photo URLs are
 * rebuilt from the hero URL the same way the server makes them.
 */
type PackedRecipe = Omit<
  CatalogRecipe,
  | "ingredients"
  | "steps"
  | "ingredientCount"
  | "caloriesPerServing"
  | "proteinPerServing"
  | "fatPerServing"
  | "tags"
  | "occasions"
  | "allergens"
  | "equipment"
> & {
  tags?: DishTag[];
  occasions?: Occasion[];
  allergens?: Allergen[];
  equipment?: string[];
  ingredients: [index: number, quantity: number, note?: string][];
  steps: [en: string, ar: string, timerMinutes?: number][];
};

type PackedCatalog = Omit<Catalog, "recipes" | "ingredients"> & {
  ingredients: (CatalogIngredient & { unit: string })[];
  recipes: PackedRecipe[];
};

/** Same hash the server uses to pin a photo per seed (prisma/data/types.ts). */
function photoLock(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 100000;
}

export function unpackCatalog(packed: PackedCatalog): Catalog {
  return {
    ...packed,
    recipes: packed.recipes.map((r) => {
      const photoBase = r.heroImageUrl.split("?")[0];
      return {
        ...r,
        tags: r.tags ?? [],
        occasions: r.occasions ?? [],
        allergens: r.allergens ?? [],
        equipment: r.equipment ?? [],
        ingredientCount: r.ingredients.length,
        caloriesPerServing: r.nutritionPerServing.calories,
        proteinPerServing: r.nutritionPerServing.proteinGrams,
        fatPerServing: r.nutritionPerServing.fatGrams,
        ingredients: r.ingredients.map(([index, quantity, note]) => {
          const ing = packed.ingredients[index];
          return { id: ing.id, quantity, unit: ing.unit, note: note ?? null };
        }),
        steps: r.steps.map(([en, ar, timerMinutes], i) => ({
          order: i + 1,
          timerMinutes: timerMinutes ?? null,
          imageUrl: `${photoBase}?lock=${photoLock(`${r.slug}-step-${i + 1}`)}`,
          instruction: { en, ar },
        })),
      };
    }),
  };
}

const catalog = unpackCatalog(catalogJson as unknown as PackedCatalog);
const ingredientById = new Map(catalog.ingredients.map((i) => [i.id, i]));
const cuisineBySlug = new Map(catalog.cuisines.map((c) => [c.slug, c]));
// The server lists recipes by (English) title.
const recipesByTitle = [...catalog.recipes].sort((a, b) => a.title.en.localeCompare(b.title.en));

export const CATALOG_RECIPE_COUNT = catalog.recipes.length;

function lang(value: unknown): Lang {
  return value === "ar" ? "ar" : "en";
}

function summary(r: CatalogRecipe, l: Lang): RecipeSummary {
  const cuisine = cuisineBySlug.get(r.cuisineSlug);
  return {
    id: r.slug,
    slug: r.slug,
    title: r.title[l],
    description: r.description[l],
    dishType: r.dishType,
    heroImageUrl: r.heroImageUrl,
    baseServings: r.baseServings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    difficulty: r.difficulty,
    tags: r.tags,
    occasions: r.occasions,
    avgRating: null,
    ratingCount: 0,
    costPerServing: r.costPerServing,
    ingredientCount: r.ingredientCount,
    allergens: r.allergens,
    caloriesPerServing: r.caloriesPerServing,
    proteinPerServing: r.proteinPerServing,
    fatPerServing: r.fatPerServing,
    cuisine: { slug: r.cuisineSlug, name: cuisine ? cuisine.name[l] : r.cuisineSlug },
  };
}

export type ListParams = {
  cuisine?: string;
  tag?: string;
  dishType?: string;
  occasion?: string;
  ingredients?: string;
  q?: string;
  maxCalories?: number | string;
  minProtein?: number | string;
  maxCost?: number | string;
  maxMinutes?: number | string;
  sort?: string;
  lang?: string;
};

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : (value as number | undefined);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** Same filters as GET /recipes, applied in the same way. */
function filterRecipes(p: ListParams): CatalogRecipe[] {
  const ids = p.ingredients ? new Set(p.ingredients.split(",").filter(Boolean)) : null;
  const q = p.q?.trim().toLowerCase();
  const maxCalories = num(p.maxCalories);
  const minProtein = num(p.minProtein);
  const maxCost = num(p.maxCost);
  const maxMinutes = num(p.maxMinutes);
  return recipesByTitle.filter((r) => {
    if (p.cuisine && r.cuisineSlug !== p.cuisine) return false;
    if (p.dishType && r.dishType.toLowerCase() !== p.dishType.toLowerCase()) return false;
    if (p.tag && !r.tags.includes(p.tag.toUpperCase() as DishTag)) return false;
    if (p.occasion && !r.occasions.includes(p.occasion.toUpperCase() as Occasion)) return false;
    if (ids && ids.size > 0 && !r.ingredients.some((i) => ids.has(i.id))) return false;
    if (q) {
      const inTitle = r.title.en.toLowerCase().includes(q) || r.title.ar.toLowerCase().includes(q);
      const inIngredients = r.ingredients.some((i) => {
        const ing = ingredientById.get(i.id);
        return !!ing && (ing.name.en.toLowerCase().includes(q) || ing.name.ar.toLowerCase().includes(q));
      });
      if (!inTitle && !inIngredients) return false;
    }
    if (maxCalories != null && r.caloriesPerServing > maxCalories) return false;
    if (minProtein != null && r.proteinPerServing < minProtein) return false;
    if (maxCost != null && r.costPerServing > maxCost) return false;
    if (maxMinutes != null && r.prepMinutes + r.cookMinutes > maxMinutes) return false;
    return true;
  });
}

const SORTS: Record<string, (a: RecipeSummary, b: RecipeSummary) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  cost: (a, b) => a.costPerServing - b.costPerServing,
  calories: (a, b) => a.caloriesPerServing - b.caloriesPerServing,
  protein: (a, b) => b.proteinPerServing - a.proteinPerServing,
  time: (a, b) => a.prepMinutes + a.cookMinutes - (b.prepMinutes + b.cookMinutes),
  rating: (a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1),
};

export function listRecipes(p: ListParams): RecipeSummary[] {
  const l = lang(p.lang);
  const list = filterRecipes(p).map((r) => summary(r, l));
  const sort = p.sort ? SORTS[p.sort] : undefined;
  return sort ? [...list].sort((a, b) => sort(a, b) || a.title.localeCompare(b.title)) : list;
}

export function listCuisines(l: Lang): Cuisine[] {
  // Ordered by English name in both languages, as the server does.
  return [...catalog.cuisines]
    .sort((a, b) => a.name.en.localeCompare(b.name.en))
    .map((c) => ({
      id: c.slug,
      slug: c.slug,
      name: c.name[l],
      recipeCount: catalog.recipes.filter((r) => r.cuisineSlug === c.slug).length,
    }));
}

export function cuisineStats(l: Lang): CuisineStats[] {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return catalog.cuisines
    .map((c) => {
      const rs = catalog.recipes.filter((r) => r.cuisineSlug === c.slug);
      return {
        slug: c.slug,
        name: c.name[l],
        recipeCount: rs.length,
        avgCostPerServing: Math.round(avg(rs.map((r) => r.costPerServing)) * 10) / 10,
        avgCalories: Math.round(avg(rs.map((r) => r.caloriesPerServing))),
        avgMinutes: Math.round(avg(rs.map((r) => r.prepMinutes + r.cookMinutes))),
        avgRating: null,
        quickCount: rs.filter((r) => r.tags.includes("QUICK")).length,
        vegetarianCount: rs.filter((r) => r.tags.includes("VEGETARIAN")).length,
      };
    })
    .filter((s) => s.recipeCount > 0)
    .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name));
}

/** Same djb2-style hash as the server, so a seeded pick (recipe of the day) matches it. */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
  return Math.abs(hash);
}

export function randomRecipe(p: ListParams & { seed?: string }): { slug: string } | null {
  const candidates = filterRecipes({ ...p, q: undefined, ingredients: undefined }).sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
  );
  if (candidates.length === 0) return null;
  const pick = p.seed
    ? candidates[hashSeed(p.seed) % candidates.length]
    : candidates[Math.floor(Math.random() * candidates.length)];
  return { slug: pick.slug };
}

export function recipeDetail(slug: string, l: Lang): RecipeDetail | null {
  const r = catalog.recipes.find((x) => x.slug === slug);
  if (!r) return null;
  return {
    ...summary(r, l),
    ingredients: r.ingredients.map((i) => {
      const ing = ingredientById.get(i.id);
      return {
        name: ing ? ing.name[l] : "",
        quantity: i.quantity,
        unit: i.unit,
        note: i.note,
        substitute: ing ? ing.substitute[l] : null,
        allergens: ing?.allergens ?? [],
        category: ing?.category ?? "other",
        substitutedFrom: null,
      };
    }),
    steps: r.steps.map((s) => ({
      order: s.order,
      instruction: s.instruction[l],
      imageUrl: s.imageUrl ?? "",
      timerMinutes: s.timerMinutes,
    })),
    nutritionPerServing: r.nutritionPerServing,
    myRating: null,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    adaptedForGoal: null,
    reviews: [],
    equipment: r.equipment,
  };
}

export function listIngredients(l: Lang): PantryIngredient[] {
  return [...catalog.ingredients]
    .sort((a, b) => a.name.en.localeCompare(b.name.en))
    .map((i) => ({ id: i.id, name: i.name[l], category: i.category, substitute: i.substitute[l] }));
}

/** Recipes ranked by the share of their ingredients you have, like POST /recipes/pantry-match. */
export function pantryMatch(ingredientIds: string[], l: Lang): PantryMatch[] {
  const have = new Set(ingredientIds);
  return catalog.recipes
    .map((r) => {
      const matched = r.ingredients.filter((i) => have.has(i.id)).length;
      const missing = r.ingredients.filter((i) => !have.has(i.id));
      return { r, matched, total: r.ingredients.length, missing };
    })
    .filter((s) => s.matched > 0)
    .sort(
      (a, b) =>
        b.matched / b.total - a.matched / a.total ||
        a.missing.length - b.missing.length ||
        a.r.slug.localeCompare(b.r.slug)
    )
    .map((s) => ({
      ...summary(s.r, l),
      matchedIngredientCount: s.matched,
      totalIngredientCount: s.total,
      missingIngredientNames: s.missing.map((i) => ingredientById.get(i.id)?.name[l] ?? ""),
    }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Same scaling and pricing as the server's computeShoppingList; nothing is saved. */
export function shoppingList(slug: string, servings: number, budget: number | undefined, l: Lang): ShoppingListResult | null {
  const r = catalog.recipes.find((x) => x.slug === slug);
  if (!r) return null;
  const scale = servings / r.baseServings;
  const items = r.ingredients.map((i) => {
    const ing = ingredientById.get(i.id);
    const quantity = round2(i.quantity * scale);
    return {
      ingredientName: ing ? ing.name[l] : "",
      quantity,
      unit: i.unit,
      estimatedCost: round2(quantity * (ing?.pricePerUnit ?? 0)),
      category: ing?.category ?? null,
    };
  });
  const totalEstimatedCost = round2(items.reduce((s, i) => s + i.estimatedCost, 0));
  return {
    id: `local-${slug}-${servings}`,
    recipe: { slug, title: r.title[l] },
    servings,
    budget: budget ?? null,
    totalEstimatedCost,
    withinBudget: budget == null ? true : totalEstimatedCost <= budget,
    budgetDifference: budget == null ? null : round2(budget - totalEstimatedCost),
    items,
    deliveryPartners: catalog.deliveryPartners,
  };
}

export function deliveryPartners(): DeliveryPartner[] {
  return catalog.deliveryPartners;
}

export function nearbyStores(lat?: number, lng?: number) {
  return {
    mapsSearchUrl:
      lat != null && lng != null
        ? `https://www.google.com/maps/search/supermarket/@${lat},${lng},15z`
        : "https://www.google.com/maps/search/?api=1&query=supermarket+near+me",
    deliveryPartners: catalog.deliveryPartners,
  };
}

/**
 * Maps a request the API client was about to send to a bundled answer, or
 * undefined when the request needs the real server (accounts, ratings,
 * saved lists...).
 */
export function answerLocally(method: string, url: string, params: Record<string, unknown>, body: unknown): unknown | undefined {
  const l = lang(params.lang);
  const path = url.split("?")[0].replace(/\/+$/, "");
  const m = method.toLowerCase();
  if (m === "get") {
    if (path === "/cuisines") return listCuisines(l);
    if (path === "/cuisines/stats") return cuisineStats(l);
    if (path === "/recipes") return listRecipes(params as ListParams);
    if (path === "/recipes/recommended") return listRecipes({ lang: l }).slice(0, 6);
    if (path === "/recipes/trending") return [];
    if (path === "/recipes/random") return randomRecipe(params as ListParams & { seed?: string }) ?? undefined;
    if (path === "/ingredients") return listIngredients(l);
    if (path === "/delivery-partners") return deliveryPartners();
    if (path === "/nearby-stores") return nearbyStores(num(params.lat), num(params.lng));
    const detail = path.match(/^\/recipes\/([^/]+)$/);
    if (detail) return recipeDetail(decodeURIComponent(detail[1]), l) ?? undefined;
  }
  if (m === "post") {
    const data = (typeof body === "string" ? safeParse(body) : body) as Record<string, unknown> | null;
    if (path === "/recipes/pantry-match" && Array.isArray(data?.ingredientIds)) {
      return pantryMatch(data.ingredientIds as string[], l);
    }
    const list = path.match(/^\/recipes\/([^/]+)\/shopping-list$/);
    if (list && typeof data?.servings === "number") {
      return shoppingList(decodeURIComponent(list[1]), data.servings, num(data.budget), l) ?? undefined;
    }
  }
  return undefined;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
