import type { TranslationKey } from "../i18n/translations";

const CATEGORY_EMOJI: Record<string, string> = {
  produce: "🥬",
  dairy: "🧀",
  meat: "🥩",
  seafood: "🐟",
  pantry: "🧂",
};

const CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  produce: "aisle.produce",
  dairy: "aisle.dairy",
  meat: "aisle.meat",
  seafood: "aisle.seafood",
  pantry: "aisle.pantry",
};

const CATEGORY_ORDER = ["produce", "dairy", "meat", "seafood", "pantry", "other"];

export function categoryEmoji(category: string | null | undefined): string {
  return CATEGORY_EMOJI[category ?? ""] ?? "🛒";
}

export function categoryLabelKey(category: string | null | undefined): TranslationKey {
  return CATEGORY_LABEL_KEYS[category ?? ""] ?? "aisle.other";
}

/** Groups items by their `category` field (falling back to "other"), in a stable shopping-aisle order. */
export function groupByCategory<T extends { category?: string | null }>(items: T[]): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category ?? "other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return CATEGORY_ORDER.filter((key) => groups.has(key)).map((category) => ({
    category,
    items: groups.get(category) as T[],
  }));
}
