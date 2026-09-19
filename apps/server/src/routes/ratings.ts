import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

export const ratingsRouter = Router();

const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

ratingsRouter.post("/recipes/:slug/ratings", requireAuth, async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  await prisma.rating.upsert({
    where: { userId_recipeId: { userId: req.userId!, recipeId: recipe.id } },
    update: { score: parsed.data.score, comment: parsed.data.comment },
    create: {
      userId: req.userId!,
      recipeId: recipe.id,
      score: parsed.data.score,
      comment: parsed.data.comment,
    },
  });

  const agg = await prisma.rating.aggregate({
    where: { recipeId: recipe.id },
    _avg: { score: true },
    _count: true,
  });

  res.status(201).json({
    myScore: parsed.data.score,
    average: Math.round((agg._avg.score ?? 0) * 10) / 10,
    count: agg._count,
  });
});
