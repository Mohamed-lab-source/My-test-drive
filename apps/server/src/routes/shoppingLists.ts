import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { computeShoppingList } from "../utils/shoppingListMath";

export const shoppingListsRouter = Router();

const generateSchema = z.object({
  servings: z.number().int().min(1).max(50),
  budget: z.number().positive().optional(),
});

shoppingListsRouter.post("/recipes/:slug/shopping-list", optionalAuth, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { servings, budget } = parsed.data;

  const recipe = await prisma.recipe.findUnique({
    where: { slug: req.params.slug },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const { items, totalEstimatedCost, withinBudget, budgetDifference } = computeShoppingList(
    recipe.ingredients.map((ri) => ({
      name: ri.ingredient.name,
      quantity: ri.quantity,
      displayUnit: ri.displayUnit,
      pricePerUnit: ri.ingredient.pricePerUnit,
    })),
    servings,
    recipe.baseServings,
    budget
  );

  const saved = await prisma.shoppingList.create({
    data: {
      userId: req.userId,
      recipeId: recipe.id,
      servings,
      budget,
      totalEstimatedCost,
      withinBudget,
      items: { createMany: { data: items } },
    },
    include: { items: true },
  });

  const deliveryPartners = await prisma.deliveryPartner.findMany({ orderBy: { name: "asc" } });

  res.status(201).json({
    id: saved.id,
    recipe: { slug: recipe.slug, title: recipe.title },
    servings,
    budget: budget ?? null,
    totalEstimatedCost,
    withinBudget,
    budgetDifference,
    items: saved.items.map((i) => ({
      ingredientName: i.ingredientName,
      quantity: i.quantity,
      unit: i.unit,
      estimatedCost: i.estimatedCost,
    })),
    deliveryPartners,
  });
});

shoppingListsRouter.get("/shopping-lists", requireAuth, async (req, res) => {
  const lists = await prisma.shoppingList.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { recipe: { select: { slug: true, title: true, heroImageUrl: true } } },
  });
  res.json(lists);
});

shoppingListsRouter.get("/shopping-lists/:id", requireAuth, async (req, res) => {
  const list = await prisma.shoppingList.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: {
      items: true,
      recipe: { select: { slug: true, title: true, heroImageUrl: true } },
    },
  });
  if (!list) {
    res.status(404).json({ error: "Shopping list not found" });
    return;
  }
  res.json(list);
});
