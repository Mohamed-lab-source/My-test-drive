import type { TranslationKey } from "../i18n/translations";

type EquipmentRule = { id: string; emoji: string; labelKey: TranslationKey; keywords: string[] };

const EQUIPMENT_RULES: EquipmentRule[] = [
  { id: "oven", emoji: "🔥", labelKey: "miseEnPlace.equipment.oven", keywords: ["oven", "bake", "roast", "فرن", "اخبز", "شوي"] },
  { id: "pan", emoji: "🍳", labelKey: "miseEnPlace.equipment.pan", keywords: ["pan", "skillet", "fry", "مقلاة", "اقلي"] },
  { id: "pot", emoji: "🍲", labelKey: "miseEnPlace.equipment.pot", keywords: ["pot", "boil", "simmer", "حلة", "اغل", "اسلق"] },
  { id: "knife", emoji: "🔪", labelKey: "miseEnPlace.equipment.knife", keywords: ["chop", "dice", "slice", "mince", "قطّع", "فرم"] },
  { id: "bowl", emoji: "🥣", labelKey: "miseEnPlace.equipment.bowl", keywords: ["whisk", "bowl", "mix", "combine", "fold", "وعاء", "اخلط", "اخفق"] },
  { id: "blender", emoji: "🧃", labelKey: "miseEnPlace.equipment.blender", keywords: ["blend", "blender", "food processor", "خلاط"] },
  { id: "grill", emoji: "🔥", labelKey: "miseEnPlace.equipment.grill", keywords: ["grill", "skewer", "شوي", "سيخ"] },
];

/** Best-effort equipment list inferred from step instruction keywords -- a helpful mise-en-place hint, not a guarantee of completeness. */
export function inferEquipment(instructions: string[]): EquipmentRule[] {
  const joined = instructions.join(" ").toLowerCase();
  return EQUIPMENT_RULES.filter((rule) => rule.keywords.some((kw) => joined.includes(kw)));
}
