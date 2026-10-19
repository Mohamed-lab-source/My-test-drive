import type { Difficulty, DishTag, Occasion } from "@prisma/client";

// LoremFlickr returns real photos matching given keywords (unlike the previous
// purely-random picsum.photos placeholders). "lock" pins a stable photo per
// seed instead of a different random one on every fetch. (The mobile app no
// longer renders these — see README's "Known simplifications" — but the URLs
// are still generated server-side in case a future client wants them.)
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100000;
}

export const foodImg = (keywords: string, uniqueSeed: string, w = 900, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?lock=${hashSeed(uniqueSeed)}`;

export type RecipeSeed = {
  slug: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  cuisine: string;
  dishType: string;
  // Keywords for sourcing a topically-relevant real food photo. Some dishes
  // (Egyptian ones especially) don't have great English tag coverage on
  // stock photo sites, so these fall back to the closest honest descriptor.
  imageKeywords: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  tags: DishTag[];
  occasions?: Occasion[];
  ingredients: { name: string; quantity: number; displayUnit: string; note?: string }[];
  steps: { instruction: string; instructionAr: string; timerMinutes?: number }[];
};
