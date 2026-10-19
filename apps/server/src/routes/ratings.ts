import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { localizeSummary, parseLang, recipeSummarySelect } from "./recipes";
import { createRouter } from "../utils/asyncRouter";

export const ratingsRouter = createRouter();

ratingsRouter.get("/ratings/mine", requireAuth, async (req, res) => {
  const lang = parseLang(req.query.lang);
  const ratings = await prisma.rating.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: "desc" },
    select: { score: true, comment: true, updatedAt: true, recipe: { select: recipeSummarySelect() } },
  });
  res.json(
    ratings.map((r) => ({
      score: r.score,
      comment: r.comment,
      ratedAt: r.updatedAt,
      recipe: localizeSummary(r.recipe, lang),
    }))
  );
});

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

ratingsRouter.delete("/recipes/:slug/ratings", requireAuth, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { slug: req.params.slug } });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  await prisma.rating.deleteMany({ where: { userId: req.userId!, recipeId: recipe.id } });

  const agg = await prisma.rating.aggregate({
    where: { recipeId: recipe.id },
    _avg: { score: true },
    _count: true,
  });

  res.json({ average: Math.round((agg._avg.score ?? 0) * 10) / 10, count: agg._count });
});

/** Toggles the current user's "helpful" vote on someone else's review, returning the updated count and whether they now have it voted. */
ratingsRouter.post("/ratings/:ratingId/helpful", requireAuth, async (req, res) => {
  const rating = await prisma.rating.findUnique({ where: { id: req.params.ratingId } });
  if (!rating) {
    res.status(404).json({ error: "Review not found" });
    return;
  }

  const existing = await prisma.ratingHelpfulVote.findUnique({
    where: { ratingId_userId: { ratingId: rating.id, userId: req.userId! } },
  });

  if (existing) {
    await prisma.ratingHelpfulVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.ratingHelpfulVote.create({ data: { ratingId: rating.id, userId: req.userId! } });
  }

  const helpfulCount = await prisma.ratingHelpfulVote.count({ where: { ratingId: rating.id } });
  res.json({ helpfulCount, helpfulByMe: !existing });
});
