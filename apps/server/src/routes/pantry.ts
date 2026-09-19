import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parseLang, recipeSummarySelect, localizeSummary } from "./recipes";

export const pantryRouter = Router();

pantryRouter.get("/ingredients", async (req, res) => {
  const lang = parseLang(req.query.lang);
  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, nameAr: true, category: true },
    orderBy: { name: "asc" },
  });
  res.json(
    ingredients.map((i) => ({
      id: i.id,
      name: lang === "ar" ? i.nameAr ?? i.name : i.name,
      category: i.category,
    }))
  );
});

const pantryMatchSchema = z.object({
  ingredientIds: z.array(z.string()).min(1),
  lang: z.string().optional(),
});

/**
 * "What can I cook?" -- ranks recipes by how many of the given ingredient
 * IDs they use, highest match ratio first (fewest missing ingredients as
 * tiebreaker). Only returns recipes that use at least one of them.
 */
pantryRouter.post("/recipes/pantry-match", async (req, res) => {
  const parsed = pantryMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const lang = parseLang(parsed.data.lang);
  const haveSet = new Set(parsed.data.ingredientIds);

  const recipes = await prisma.recipe.findMany({ select: recipeSummarySelect() });

  const scored = recipes
    .map((r) => {
      const total = r.ingredients.length;
      const matched = r.ingredients.filter((ri) => haveSet.has(ri.ingredient.id));
      const missing = r.ingredients.filter((ri) => !haveSet.has(ri.ingredient.id));
      return { recipe: r, matchedCount: matched.length, total, missing };
    })
    .filter((s) => s.matchedCount > 0)
    .sort((a, b) => b.matchedCount / b.total - a.matchedCount / a.total || a.missing.length - b.missing.length);

  res.json(
    scored.map((s) => ({
      ...localizeSummary(s.recipe, lang),
      matchedIngredientCount: s.matchedCount,
      totalIngredientCount: s.total,
      missingIngredientNames: s.missing.map((ri) =>
        lang === "ar" ? ri.ingredient.nameAr ?? ri.ingredient.name : ri.ingredient.name
      ),
    }))
  );
});
