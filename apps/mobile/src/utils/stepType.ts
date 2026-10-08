export type StepType = "chop" | "boil" | "bake" | "fry" | "mix" | "other";

const KEYWORDS: Record<StepType, string[]> = {
  chop: ["chop", "dice", "slice", "mince", "cut", "قطّع", "قطع", "فرم", "تقطيع", "شرّح"],
  boil: ["boil", "simmer", "poach", "اغل", "غلي", "اسلق", "سلق", "نضّج"],
  bake: ["bake", "oven", "roast", "اخبز", "خبز", "فرن", "شوي", "اشوي"],
  fry: ["fry", "sauté", "saute", "sear", "pan-fry", "اقلي", "قلي", "حمّر", "تحمير"],
  mix: ["mix", "whisk", "stir", "combine", "fold", "blend", "beat", "اخلط", "خلط", "قلّب", "اخفق", "خفق"],
  other: [],
};

/** Best-effort step-type classifier from instruction keywords (English and Arabic), for a small visual icon -- not a precise parse, just a helpful hint. */
export function classifyStepType(instruction: string): StepType {
  const lower = instruction.toLowerCase();
  for (const type of ["chop", "boil", "bake", "fry", "mix"] as StepType[]) {
    if (KEYWORDS[type].some((kw) => lower.includes(kw))) return type;
  }
  return "other";
}

export const STEP_TYPE_EMOJI: Record<StepType, string> = {
  chop: "🔪",
  boil: "♨️",
  bake: "🔥",
  fry: "🍳",
  mix: "🥣",
  other: "👨‍🍳",
};
