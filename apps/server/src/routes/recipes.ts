import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { optionalAuth } from "../middleware/auth";
import type { DishTag } from "@prisma/client";

export const recipesRouter = Router();

recipesRouter.get("/cuisines", async (_req, res) => {
  const cuisines = await prisma.cuisine.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });
  res.json(
    cuisines.map((c) => ({ id: c.id, slug: c.slug, name: c.name, recipeCount: c._count.recipes }))
  );
});

const recipeSummarySelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  dishType: true,
  heroImageUrl: true,
  baseServings: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  tags: true,
  cuisine: { select: { slug: true, name: true } },
} as const;

const listQuerySchema = z.object({
  cuisine: z.string().optional(),
  tag: z.string().optional(),
  dishType: z.string().optional(),
  q: z.string().optional(),
});

recipesRouter.get("/recipes", optionalAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { cuisine, tag, dishType, q } = parsed.data;

  const recipes = await prisma.recipe.findMany({
    where: {
      cuisine: cuisine ? { slug: cuisine } : undefined,
      dishType: dishType ? { equals: dishType, mode: "insensitive" } : undefined,
      tags: tag ? { has: tag.toUpperCase() as DishTag } : undefined,
      title: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    select: recipeSummarySelect,
    orderBy: { title: "asc" },
  });
  res.json(recipes);
});

/**
 * Personalized recommendations: recipes matching the user's diet goal (FIT -> tag FIT,
 * INDULGENT -> tag DESSERT) and favorite cuisines are ranked first. Falls back to a
 * generic popular set for anonymous users.
 */
recipesRouter.get("/recipes/recommended", optionalAuth, async (req, res) => {
  const allRecipes = await prisma.recipe.findMany({
    select: recipeSummarySelect,
    orderBy: { title: "asc" },
  });

  let preference = null;
  if (req.userId) {
    preference = await prisma.preference.findUnique({ where: { userId: req.userId } });
  }

  if (!preference) {
    res.json(allRecipes.slice(0, 6));
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
  res.json(scored.map((s) => s.recipe));
});

recipesRouter.get("/recipes/:slug", async (req, res) => {
  const recipe = await prisma.recipe.findUnique({
    where: { slug: req.params.slug },
    include: {
      cuisine: { select: { slug: true, name: true } },
      ingredients: {
        include: { ingredient: true },
      },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

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
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    dishType: recipe.dishType,
    heroImageUrl: recipe.heroImageUrl,
    baseServings: recipe.baseServings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    tags: recipe.tags,
    nutritionPerServing,
    ingredients: recipe.ingredients.map((ri) => ({
      name: ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.displayUnit,
      note: ri.note,
    })),
    steps: recipe.steps.map((s) => ({
      order: s.order,
      instruction: s.instruction,
      imageUrl: s.imageUrl,
      timerMinutes: s.timerMinutes,
    })),
  });
});
