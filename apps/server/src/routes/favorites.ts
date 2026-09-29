import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { localizeSummary, parseLang, recipeSummarySelect } from "./recipes";

export const favoritesRouter = Router();

favoritesRouter.get("/favorites", requireAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    select: { recipe: { select: recipeSummarySelect() } },
  });
  res.json(favorites.map((f) => localizeSummary(f.recipe, lang)));
});

favoritesRouter.post("/favorites/:slug", requireAuth, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  await prisma.favorite.upsert({
    where: { userId_recipeId: { userId: req.userId!, recipeId: recipe.id } },
    update: {},
    create: { userId: req.userId!, recipeId: recipe.id },
  });
  res.status(201).json({ favorited: true });
});

favoritesRouter.delete("/favorites/:slug", requireAuth, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  await prisma.favorite.deleteMany({ where: { userId: req.userId!, recipeId: recipe.id } });
  res.json({ favorited: false });
});
