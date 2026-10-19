/**
 * Writes the recipe catalog into the mobile app (apps/mobile/src/data/
 * catalog.json) so the app works without reaching the API. Re-run after
 * changing the seed:
 *
 *   npx tsx prisma/seed.ts            # local DB up to date
 *   npx tsx watch src/index.ts &      # local API running
 *   npx tsx scripts/exportCatalog.ts
 *
 * Values come from the running API itself (so cost, nutrition, allergens and
 * equipment are computed exactly as the server does) plus a direct DB read
 * for what the API doesn't expose: ingredient ids per recipe and prices.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const API = process.env.EXPORT_API_URL ?? "http://localhost:4000/api";
const OUT = join(__dirname, "../../mobile/src/data/catalog.json");
const prisma = new PrismaClient();

type Lang = "en" | "ar";

async function get<T>(path: string, lang: Lang): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${path}${sep}lang=${lang}`);
  if (!res.ok) throw new Error(`${path} (${lang}) -> ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const [summariesEn, summariesAr, cuisinesEn, cuisinesAr, partners] = await Promise.all([
    get<any[]>("/recipes", "en"),
    get<any[]>("/recipes", "ar"),
    get<any[]>("/cuisines", "en"),
    get<any[]>("/cuisines", "ar"),
    get<any[]>("/delivery-partners", "en"),
  ]);
  const arBySlug = new Map(summariesAr.map((s) => [s.slug, s]));

  const ingredientRows = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  const recipeRows = await prisma.recipe.findMany({
    select: { slug: true, ingredients: { select: { ingredientId: true, quantity: true, ingredient: { select: { name: true } } } } },
  });
  const refsBySlug = new Map(recipeRows.map((r) => [r.slug, r.ingredients]));

  const recipes = [];
  for (const en of summariesEn) {
    const ar = arBySlug.get(en.slug);
    const [detailEn, detailAr] = await Promise.all([
      get<any>(`/recipes/${en.slug}`, "en"),
      get<any>(`/recipes/${en.slug}`, "ar"),
    ]);
    // Pair each API ingredient with its DB row by name (then quantity), not
    // by position, since neither query guarantees an order.
    const unused = [...(refsBySlug.get(en.slug) ?? [])];
    const idFor = (name: string, quantity: number) => {
      let i = unused.findIndex((r) => r.ingredient.name === name && r.quantity === quantity);
      if (i < 0) i = unused.findIndex((r) => r.ingredient.name === name);
      if (i < 0) throw new Error(`no DB ingredient "${name}" for ${en.slug}`);
      return unused.splice(i, 1)[0].ingredientId;
    };
    recipes.push({
      slug: en.slug,
      title: { en: en.title, ar: ar?.title ?? en.title },
      description: { en: en.description, ar: ar?.description ?? en.description },
      cuisineSlug: en.cuisine.slug,
      dishType: en.dishType,
      heroImageUrl: en.heroImageUrl,
      baseServings: en.baseServings,
      prepMinutes: en.prepMinutes,
      cookMinutes: en.cookMinutes,
      difficulty: en.difficulty,
      tags: en.tags,
      occasions: en.occasions,
      costPerServing: en.costPerServing,
      ingredientCount: en.ingredientCount,
      allergens: en.allergens,
      caloriesPerServing: en.caloriesPerServing,
      proteinPerServing: en.proteinPerServing,
      fatPerServing: en.fatPerServing,
      nutritionPerServing: detailEn.nutritionPerServing,
      equipment: detailEn.equipment ?? [],
      // Ingredient order and quantities match the detail response; names,
      // substitutes, categories and allergens come from the ingredient table.
      ingredients: detailEn.ingredients.map((ing: any) => ({
        id: idFor(ing.name, ing.quantity),
        quantity: ing.quantity,
        unit: ing.unit,
        note: ing.note,
      })),
      steps: detailEn.steps.map((s: any, i: number) => ({
        order: s.order,
        timerMinutes: s.timerMinutes ?? null,
        imageUrl: s.imageUrl ?? null,
        instruction: { en: s.instruction, ar: detailAr.steps[i]?.instruction ?? s.instruction },
      })),
    });
  }

  const cuisineAr = new Map(cuisinesAr.map((c) => [c.slug, c.name]));
  const catalog = {
    generatedAt: new Date().toISOString(),
    cuisines: cuisinesEn.map((c) => ({ slug: c.slug, name: { en: c.name, ar: cuisineAr.get(c.slug) ?? c.name } })),
    ingredients: ingredientRows.map((i) => ({
      id: i.id,
      name: { en: i.name, ar: i.nameAr ?? i.name },
      category: i.category,
      substitute: { en: i.substituteEn ?? null, ar: i.substituteAr ?? i.substituteEn ?? null },
      allergens: i.allergens,
      pricePerUnit: i.pricePerUnit,
    })),
    deliveryPartners: partners,
    recipes,
  };
  writeFileSync(OUT, JSON.stringify(catalog));
  console.log(`Wrote ${recipes.length} recipes, ${catalog.ingredients.length} ingredients to ${OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
