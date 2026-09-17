import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { optionalAuth } from "../middleware/auth";
import type { DishTag } from "@prisma/client";

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
  } as const;
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
 * Personalized recommendations: recipes matching the user's diet goal (FIT -> tag FIT,
 * INDULGENT -> tag DESSERT) and favorite cuisines are ranked first. Falls back to a
 * generic popular set for anonymous users.
 */
recipesRouter.get("/recipes/recommended", optionalAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const allRecipes = await prisma.recipe.findMany({
    select: recipeSummarySelect(),
    orderBy: { title: "asc" },
  });

  let preference = null;
  if (req.userId) {
    preference = await prisma.preference.findUnique({ where: { userId: req.userId } });
  }

  if (!preference) {
    res.json(allRecipes.slice(0, 6).map((r) => localizeSummary(r, lang)));
    return;
  }

  const wantsTag: DishTag | null =
    preference.dietGoal === "FIT" ? "FIT" : preference.dietGoal === "INDULGENT" ? "DESSERT" : null;
  const favoriteCuisines = new Set(preference.favoriteCuisineSlugs);

  const scored = allRecipes.map((r) => {
    let score = 0;
    if (wantsTag && r.tags.includes(wantsTag)) score += 2;
    if (favoriteCuisines.has(r.cuisine.slug)) score += 1;
    return { recipe: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  res.json(scored.map((s) => localizeSummary(s.recipe, lang)));
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
    ingredients: recipe.ingredients.map((ri) => ({
      name: lang === "ar" ? ri.ingredient.nameAr ?? ri.ingredient.name : ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.displayUnit,
      note: ri.note,
      substitute: lang === "ar" ? ri.ingredient.substituteAr ?? ri.ingredient.substituteEn : ri.ingredient.substituteEn,
    })),
    steps: recipe.steps.map((s) => ({
      order: s.order,
      instruction: lang === "ar" ? s.instructionAr ?? s.instruction : s.instruction,
      imageUrl: s.imageUrl,
      timerMinutes: s.timerMinutes,
    })),
  });
});
