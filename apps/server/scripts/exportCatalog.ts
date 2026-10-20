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

  // Index of each ingredient in the exported table; recipes refer to it by
  // position (see PackedCatalog in apps/mobile/src/api/localCatalog.ts).
  const indexById = new Map(ingredientRows.map((row, i) => [row.id, i]));
  const unitById = new Map(ingredientRows.map((row) => [row.id, row.unit]));
  const nonEmpty = <T,>(xs: T[] | undefined) => (xs && xs.length ? xs : undefined);

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
    const photoBase = String(en.heroImageUrl).split("?")[0];
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
      tags: nonEmpty(en.tags),
      occasions: nonEmpty(en.occasions),
      costPerServing: en.costPerServing,
      allergens: nonEmpty(en.allergens),
      nutritionPerServing: detailEn.nutritionPerServing,
      equipment: nonEmpty(detailEn.equipment),
      // Ingredient order and quantities match the detail response; names,
      // units, substitutes, categories and allergens come from the
      // ingredient table.
      ingredients: detailEn.ingredients.map((ing: any) => {
        const id = idFor(ing.name, ing.quantity);
        if (ing.unit !== unitById.get(id)) throw new Error(`${en.slug}: ${ing.name} unit ${ing.unit} != ${unitById.get(id)}`);
        return ing.note ? [indexById.get(id), ing.quantity, ing.note] : [indexById.get(id), ing.quantity];
      }),
      steps: detailEn.steps.map((s: any, i: number) => {
        // The app rebuilds step photos from the hero URL; make sure it can.
        if (s.order !== i + 1) throw new Error(`${en.slug}: step order ${s.order} at position ${i}`);
        if (s.imageUrl && !String(s.imageUrl).startsWith(`${photoBase}?lock=`)) throw new Error(`${en.slug}: step photo URL differs from hero`);
        const arText = detailAr.steps[i]?.instruction ?? s.instruction;
        return s.timerMinutes ? [s.instruction, arText, s.timerMinutes] : [s.instruction, arText];
      }),
    });
    // Same derived values the app recomputes; fail loudly if they ever drift.
    const n = detailEn.nutritionPerServing;
    if (en.caloriesPerServing !== n.calories || en.proteinPerServing !== n.proteinGrams || en.fatPerServing !== n.fatGrams) {
      throw new Error(`${en.slug}: summary nutrition differs from detail`);
    }
  }

  const cuisineAr = new Map(cuisinesAr.map((c) => [c.slug, c.name]));
  const catalog = {
    version: 2,
    generatedAt: new Date().toISOString(),
    cuisines: cuisinesEn.map((c) => ({ slug: c.slug, name: { en: c.name, ar: cuisineAr.get(c.slug) ?? c.name } })),
    ingredients: ingredientRows.map((i) => ({
      id: i.id,
      name: { en: i.name, ar: i.nameAr ?? i.name },
      category: i.category,
      unit: i.unit,
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
