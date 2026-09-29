import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { localizeSummary, parseLang, recipeSummarySelect } from "./recipes";

export const collectionsRouter = Router();

function serializeCollection(c: { id: string; name: string; createdAt: Date; recipes: { recipe: any }[] }, lang: "en" | "ar") {
  return {
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    recipes: c.recipes.map((r) => localizeSummary(r.recipe, lang)),
  };
}

collectionsRouter.get("/collections", requireAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const collections = await prisma.collection.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
    include: { recipes: { include: { recipe: { select: recipeSummarySelect() } } } },
  });
  res.json(collections.map((c) => serializeCollection(c, lang)));
});

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

collectionsRouter.post("/collections", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const lang = parseLang(req.query.lang);
  const collection = await prisma.collection.create({
    data: { userId: req.userId!, name: parsed.data.name },
    include: { recipes: { include: { recipe: { select: recipeSummarySelect() } } } },
  });
  res.status(201).json(serializeCollection(collection, lang));
});

collectionsRouter.put("/collections/:id", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.collection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  await prisma.collection.update({ where: { id: existing.id }, data: { name: parsed.data.name } });
  res.json({ ok: true });
});

collectionsRouter.delete("/collections/:id", requireAuth, async (req, res) => {
  const existing = await prisma.collection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  await prisma.collection.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

collectionsRouter.post("/collections/:id/recipes/:slug", requireAuth, async (req, res) => {
  const collection = await prisma.collection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  await prisma.collectionRecipe.upsert({
    where: { collectionId_recipeId: { collectionId: collection.id, recipeId: recipe.id } },
    update: {},
    create: { collectionId: collection.id, recipeId: recipe.id },
  });
  res.status(201).json({ ok: true });
});

collectionsRouter.delete("/collections/:id/recipes/:slug", requireAuth, async (req, res) => {
  const collection = await prisma.collection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  await prisma.collectionRecipe.deleteMany({ where: { collectionId: collection.id, recipeId: recipe.id } });
  res.json({ ok: true });
});
