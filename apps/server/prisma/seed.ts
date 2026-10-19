import { Prisma, PrismaClient } from "@prisma/client";
import { ingredientMaster } from "./data/ingredients";
import { cuisines } from "./data/cuisines";
import { deliveryPartners } from "./data/deliveryPartners";
import { allRecipes as recipes } from "./data/recipes";
import { foodImg } from "./data/types";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding ingredients...");
  const ingredientBySlug = new Map<string, string>();
  for (const ing of ingredientMaster) {
    // "pcs" nutrition is already per-item; "g"/"ml" is authored per 100 units.
    const divisor = ing.unit === "pcs" ? 1 : 100;
    const perUnit = {
      caloriesPerUnit: ing.nutrition.kcal / divisor,
      proteinPerUnit: ing.nutrition.protein / divisor,
      fatPerUnit: ing.nutrition.fat / divisor,
      carbsPerUnit: ing.nutrition.carbs / divisor,
    };
    const row = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: {
        nameAr: ing.nameAr,
        unit: ing.unit,
        pricePerUnit: ing.pricePerUnit,
        category: ing.category,
        substituteEn: ing.substituteEn,
        substituteAr: ing.substituteAr,
        allergens: ing.allergens ?? [],
        goalSubstitutes: ing.goalSubstitutes ?? Prisma.JsonNull,
        ...perUnit,
      },
      create: {
        name: ing.name,
        nameAr: ing.nameAr,
        unit: ing.unit,
        pricePerUnit: ing.pricePerUnit,
        category: ing.category,
        substituteEn: ing.substituteEn,
        substituteAr: ing.substituteAr,
        allergens: ing.allergens ?? [],
        goalSubstitutes: ing.goalSubstitutes ?? Prisma.JsonNull,
        ...perUnit,
      },
    });
    ingredientBySlug.set(ing.name, row.id);
  }

  console.log("Seeding cuisines...");
  const cuisineBySlug = new Map<string, string>();
  // Only cuisines that have recipes, so the app never lists an empty one
  // while a new cuisine's recipes are still being written.
  const usedCuisines = new Set(recipes.map((r) => r.cuisine));
  for (const c of cuisines.filter((c) => usedCuisines.has(c.slug))) {
    const row = await prisma.cuisine.upsert({
      where: { slug: c.slug },
      update: { name: c.name, nameAr: c.nameAr },
      create: c,
    });
    cuisineBySlug.set(c.slug, row.id);
  }

  console.log("Seeding delivery partners...");
  for (const dp of deliveryPartners) {
    await prisma.deliveryPartner.upsert({
      where: { slug: dp.slug },
      update: dp,
      create: dp,
    });
  }

  console.log("Seeding recipes...");
  for (const r of recipes) {
    const cuisineId = cuisineBySlug.get(r.cuisine);
    if (!cuisineId) throw new Error(`Unknown cuisine ${r.cuisine}`);

    // Clean slate for idempotent re-seeding: delete existing recipe + children first.
    const existing = await prisma.recipe.findUnique({ where: { slug: r.slug } });
    if (existing) {
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
      await prisma.recipeStep.deleteMany({ where: { recipeId: existing.id } });
    }

    const recipe = await prisma.recipe.upsert({
      where: { slug: r.slug },
      update: {
        title: r.title,
        titleAr: r.titleAr,
        description: r.description,
        descriptionAr: r.descriptionAr,
        cuisineId,
        dishType: r.dishType,
        heroImageUrl: foodImg(r.imageKeywords, r.slug),
        baseServings: r.baseServings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        difficulty: r.difficulty,
        tags: r.tags,
        occasions: r.occasions ?? [],
      },
      create: {
        slug: r.slug,
        title: r.title,
        titleAr: r.titleAr,
        description: r.description,
        descriptionAr: r.descriptionAr,
        cuisineId,
        dishType: r.dishType,
        heroImageUrl: foodImg(r.imageKeywords, r.slug),
        baseServings: r.baseServings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        difficulty: r.difficulty,
        tags: r.tags,
        occasions: r.occasions ?? [],
      },
    });

    // One insert per table per recipe (createMany keeps array order) -- with
    // ~2000 recipes, row-by-row inserts made seeding take minutes.
    await prisma.recipeIngredient.createMany({
      data: r.ingredients.map((ri) => {
        const ingredientId = ingredientBySlug.get(ri.name);
        if (!ingredientId) throw new Error(`Unknown ingredient ${ri.name} for recipe ${r.slug}`);
        return { recipeId: recipe.id, ingredientId, quantity: ri.quantity, displayUnit: ri.displayUnit, note: ri.note };
      }),
    });

    await prisma.recipeStep.createMany({
      data: r.steps.map((step, i) => ({
        recipeId: recipe.id,
        order: i + 1,
        instruction: step.instruction,
        instructionAr: step.instructionAr,
        imageUrl: foodImg(r.imageKeywords, `${r.slug}-step-${i + 1}`),
        timerMinutes: step.timerMinutes,
      })),
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
