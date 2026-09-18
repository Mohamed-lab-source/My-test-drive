import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { optionalAuth } from "../middleware/auth";
import type { DietGoal, DishTag } from "@prisma/client";

export const recipesRouter = Router();

export type Lang = "en" | "ar";

export function parseLang(value: unknown): Lang {
  return value === "ar" ? "ar" : "en";
}

recipesRouter.get("/cuisines", async (req, res) => {
  const lang = parseLang(req.query.lang);
  const cuisines = await prisma.cuisine.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });
  res.json(
    cuisines.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: lang === "ar" ? c.nameAr ?? c.name : c.name,
      recipeCount: c._count.recipes,
    }))
  );
});

export function recipeSummarySelect() {
  return {
    id: true,
    slug: true,
    title: true,
    titleAr: true,
    description: true,
    descriptionAr: true,
    dishType: true,
    heroImageUrl: true,
    baseServings: true,
    prepMinutes: true,
    cookMinutes: true,
    difficulty: true,
    tags: true,
    cuisine: { select: { slug: true, name: true, nameAr: true } },
    ratings: { select: { score: true } },
    ingredients: {
      select: {
        quantity: true,
        ingredient: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            pricePerUnit: true,
            allergens: true,
            caloriesPerUnit: true,
            proteinPerUnit: true,
          },
        },
      },
    },
  } as const;
}

function estimateCostPerServing(
  ingredients: { quantity: number; ingredient: { pricePerUnit: number } }[],
  baseServings: number
): number {
  const totalCost = ingredients.reduce((sum, ri) => sum + ri.quantity * ri.ingredient.pricePerUnit, 0);
  return Math.round((totalCost / baseServings) * 100) / 100;
}

function estimateNutritionSummary(
  ingredients: { quantity: number; ingredient: { caloriesPerUnit: number; proteinPerUnit: number } }[],
  baseServings: number
): { caloriesPerServing: number; proteinPerServing: number } {
  const totals = ingredients.reduce(
    (acc, ri) => ({
      kcal: acc.kcal + ri.quantity * ri.ingredient.caloriesPerUnit,
      protein: acc.protein + ri.quantity * ri.ingredient.proteinPerUnit,
    }),
    { kcal: 0, protein: 0 }
  );
  return {
    caloriesPerServing: Math.round(totals.kcal / baseServings),
    proteinPerServing: Math.round((totals.protein / baseServings) * 10) / 10,
  };
}

function collectAllergens(ingredients: { ingredient: { allergens: string[] } }[]): string[] {
  const set = new Set<string>();
  for (const ri of ingredients) {
    for (const a of ri.ingredient.allergens) set.add(a);
  }
  return Array.from(set).sort();
}

export function localizeSummary(r: any, lang: Lang) {
  const ratingCount = r.ratings?.length ?? 0;
  const avgRating =
    ratingCount > 0
      ? Math.round((r.ratings.reduce((sum: number, x: { score: number }) => sum + x.score, 0) / ratingCount) * 10) / 10
      : null;
  return {
    id: r.id,
    slug: r.slug,
    title: lang === "ar" ? r.titleAr ?? r.title : r.title,
    description: lang === "ar" ? r.descriptionAr ?? r.description : r.description,
    dishType: r.dishType,
    heroImageUrl: r.heroImageUrl,
    baseServings: r.baseServings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    difficulty: r.difficulty,
    tags: r.tags,
    avgRating,
    ratingCount,
    costPerServing: estimateCostPerServing(r.ingredients, r.baseServings),
    allergens: collectAllergens(r.ingredients),
    ...estimateNutritionSummary(r.ingredients, r.baseServings),
    cuisine: {
      slug: r.cuisine.slug,
      name: lang === "ar" ? r.cuisine.nameAr ?? r.cuisine.name : r.cuisine.name,
    },
  };
}

const listQuerySchema = z.object({
  cuisine: z.string().optional(),
  tag: z.string().optional(),
  dishType: z.string().optional(),
  q: z.string().optional(),
  lang: z.string().optional(),
});

recipesRouter.get("/recipes", optionalAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { cuisine, tag, dishType, q } = parsed.data;
  const lang = parseLang(parsed.data.lang);

  const recipes = await prisma.recipe.findMany({
    where: {
      cuisine: cuisine ? { slug: cuisine } : undefined,
      dishType: dishType ? { equals: dishType, mode: "insensitive" } : undefined,
      tags: tag ? { has: tag.toUpperCase() as DishTag } : undefined,
      title: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    select: recipeSummarySelect(),
    orderBy: { title: "asc" },
  });
  res.json(recipes.map((r) => localizeSummary(r, lang)));
});

/**
 * Body-goal component of the recommendation score, using each recipe's
 * estimated nutrition per serving:
 *  - LOSE_WEIGHT: rewards lower-calorie, higher-protein (more filling) plates.
 *  - BUILD_MUSCLE: rewards protein-dense plates regardless of calories.
 *  - GAIN_WEIGHT: rewards calorie-dense plates.
 * Old style-based goals (FIT/INDULGENT) keep their original tag-matching
 * behavior for any preference rows still set to them.
 */
function goalScore(
  dietGoal: DietGoal,
  r: { tags: DishTag[]; caloriesPerServing: number; proteinPerServing: number }
): number {
  switch (dietGoal) {
    case "LOSE_WEIGHT": {
      const calorieScore = Math.max(0, 3 - r.caloriesPerServing / 200);
      const proteinScore = Math.min(2, r.proteinPerServing / 15);
      return calorieScore + proteinScore - (r.tags.includes("DESSERT") ? 1.5 : 0);
    }
    case "BUILD_MUSCLE": {
      const proteinScore = r.proteinPerServing / 10;
      return proteinScore + (r.tags.includes("FIT") ? 1 : 0);
    }
    case "GAIN_WEIGHT": {
      const calorieScore = r.caloriesPerServing / 200;
      return calorieScore + (r.tags.includes("COMFORT") || r.tags.includes("DESSERT") ? 1 : 0);
    }
    case "FIT":
      return r.tags.includes("FIT") ? 2 : 0;
    case "INDULGENT":
      return r.tags.includes("DESSERT") ? 2 : 0;
    default:
      return 0;
  }
}

/**
 * Personalized recommendations: scored by the user's body goal (see goalScore)
 * plus a boost for favorite cuisines. Falls back to a generic popular set for
 * anonymous users.
 */
recipesRouter.get("/recipes/recommended", optionalAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const allRecipes = await prisma.recipe.findMany({
    select: recipeSummarySelect(),
    orderBy: { title: "asc" },
  });
  const summaries = allRecipes.map((r) => ({ raw: r, summary: localizeSummary(r, lang) }));

  let preference = null;
  if (req.userId) {
    preference = await prisma.preference.findUnique({ where: { userId: req.userId } });
  }

  if (!preference) {
    res.json(summaries.slice(0, 6).map((s) => s.summary));
    return;
  }

  const favoriteCuisines = new Set(preference.favoriteCuisineSlugs);

  const scored = summaries.map(({ raw, summary }) => {
    let score = goalScore(preference.dietGoal, summary);
    if (favoriteCuisines.has(raw.cuisine.slug)) score += 1;
    return { summary, score };
  });
  scored.sort((a, b) => b.score - a.score);
  res.json(scored.map((s) => s.summary));
});

recipesRouter.get("/recipes/:slug", optionalAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const recipe = await prisma.recipe.findUnique({
    where: { slug: req.params.slug },
    include: {
      cuisine: { select: { slug: true, name: true, nameAr: true } },
      ingredients: {
        include: { ingredient: true },
      },
      steps: { orderBy: { order: "asc" } },
      ratings: { select: { userId: true, score: true } },
    },
  });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const ratingCount = recipe.ratings.length;
  const avgRating =
    ratingCount > 0 ? Math.round((recipe.ratings.reduce((sum, r) => sum + r.score, 0) / ratingCount) * 10) / 10 : null;
  const myRating = req.userId ? recipe.ratings.find((r) => r.userId === req.userId)?.score ?? null : null;

  const totals = recipe.ingredients.reduce(
    (acc, ri) => ({
      kcal: acc.kcal + ri.quantity * ri.ingredient.caloriesPerUnit,
      protein: acc.protein + ri.quantity * ri.ingredient.proteinPerUnit,
      fat: acc.fat + ri.quantity * ri.ingredient.fatPerUnit,
      carbs: acc.carbs + ri.quantity * ri.ingredient.carbsPerUnit,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
  const nutritionPerServing = {
    calories: Math.round(totals.kcal / recipe.baseServings),
    proteinGrams: Math.round((totals.protein / recipe.baseServings) * 10) / 10,
    fatGrams: Math.round((totals.fat / recipe.baseServings) * 10) / 10,
    carbsGrams: Math.round((totals.carbs / recipe.baseServings) * 10) / 10,
  };
  const costPerServing = estimateCostPerServing(recipe.ingredients, recipe.baseServings);
  const allergens = collectAllergens(recipe.ingredients);
  const { caloriesPerServing, proteinPerServing } = estimateNutritionSummary(recipe.ingredients, recipe.baseServings);

  res.json({
    id: recipe.id,
    slug: recipe.slug,
    title: lang === "ar" ? recipe.titleAr ?? recipe.title : recipe.title,
    description: lang === "ar" ? recipe.descriptionAr ?? recipe.description : recipe.description,
    cuisine: {
      slug: recipe.cuisine.slug,
      name: lang === "ar" ? recipe.cuisine.nameAr ?? recipe.cuisine.name : recipe.cuisine.name,
    },
    dishType: recipe.dishType,
    heroImageUrl: recipe.heroImageUrl,
    baseServings: recipe.baseServings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    tags: recipe.tags,
    avgRating,
    ratingCount,
    myRating,
    nutritionPerServing,
    costPerServing,
    allergens,
    caloriesPerServing,
    proteinPerServing,
    ingredients: recipe.ingredients.map((ri) => ({
      name: lang === "ar" ? ri.ingredient.nameAr ?? ri.ingredient.name : ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.displayUnit,
      note: ri.note,
      substitute: lang === "ar" ? ri.ingredient.substituteAr ?? ri.ingredient.substituteEn : ri.ingredient.substituteEn,
      allergens: ri.ingredient.allergens,
    })),
    steps: recipe.steps.map((s) => ({
      order: s.order,
      instruction: lang === "ar" ? s.instructionAr ?? s.instruction : s.instruction,
      imageUrl: s.imageUrl,
      timerMinutes: s.timerMinutes,
    })),
  });
});
