import type { Difficulty, DishTag, Occasion } from "@prisma/client";
import type { RecipeSeed } from "./types";
import { ingredientMaster } from "./ingredients";

const unitOf = new Map(ingredientMaster.map((i) => [i.name, i.unit]));

/**
 * [ingredient name (must exist in ingredients.ts), quantity, optional note].
 * Quantity is in the ingredient's own unit (g, ml or pcs), which is filled in
 * automatically so it can never disagree with the price/nutrition unit.
 */
export type Ing = [name: string, quantity: number, note?: string];
/** [English instruction, Arabic instruction, optional timer minutes] */
export type Step = [en: string, ar: string, timerMinutes?: number];

/**
 * Compact authoring form for recipes, so hundreds can be written per file
 * without the verbose object layout of core.ts. Produces the same RecipeSeed
 * the seed script consumes.
 */
export type RecipeArgs = {
  slug: string;
  /** [English title, Arabic title] */
  t: [string, string];
  /** [English description, Arabic description] */
  d: [string, string];
  /** cuisine slug from cuisines.ts */
  c: string;
  type: string;
  /** servings, prep minutes, cook minutes */
  s: number;
  p: number;
  k: number;
  lv: Difficulty;
  tags?: DishTag[];
  occ?: Occasion[];
  /** photo search keywords */
  img: string;
  i: Ing[];
  st: Step[];
};

export function r(x: RecipeArgs): RecipeSeed {
  return {
    slug: x.slug,
    title: x.t[0],
    titleAr: x.t[1],
    description: x.d[0],
    descriptionAr: x.d[1],
    cuisine: x.c,
    dishType: x.type,
    imageKeywords: x.img,
    baseServings: x.s,
    prepMinutes: x.p,
    cookMinutes: x.k,
    difficulty: x.lv,
    tags: x.tags ?? [],
    occasions: x.occ,
    ingredients: x.i.map(([name, quantity, note]) => ({
      name,
      quantity,
      displayUnit: unitOf.get(name) ?? "g",
      ...(note ? { note } : {}),
    })),
    steps: x.st.map(([instruction, instructionAr, timerMinutes]) => ({
      instruction,
      instructionAr,
      ...(timerMinutes ? { timerMinutes } : {}),
    })),
  };
}

/** Binds the cuisine once per file: `const eg = cuisine("egyptian")`. */
export const cuisine =
  (c: string) =>
  (x: Omit<RecipeArgs, "c">): RecipeSeed =>
    r({ ...x, c });
