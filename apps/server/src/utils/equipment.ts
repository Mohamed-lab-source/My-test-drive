export type EquipmentKey =
  | "oven"
  | "pan"
  | "pot"
  | "blender"
  | "grill"
  | "tray"
  | "whisk"
  | "bowl"
  | "knife"
  | "grater"
  | "strainer"
  | "rollingPin";

/**
 * Keyword rules over the English step text. Detection always runs on English
 * so Arabic and English readers see the same list. The rules lean towards
 * listing a tool: finding out you need the blender mid-recipe is worse than
 * one extra line.
 */
const RULES: { key: EquipmentKey; pattern: RegExp }[] = [
  { key: "oven", pattern: /\boven\b|\bbake|\broast(?!ed (?:peppers|nuts|sesame))|\bbroil/i },
  { key: "pan", pattern: /(?<!(?:baking|cake|loaf|tart|pie|sheet|roasting) )\bpan\b|skillet|\bwok\b|\bfry|\bfried\b|sauté|\bsaute|stir-fry|\bsear/i },
  { key: "pot", pattern: /\bpot\b|saucepan|\bboil|simmer|\bbroth|\bstock\b|\bpoach/i },
  { key: "blender", pattern: /\bblend|food processor|\bpur[ée]e/i },
  { key: "grill", pattern: /\bgrill|barbecue|charcoal|\bbroiler\b|over (?:a |an )?(?:open )?flame/i },
  { key: "tray", pattern: /\btray\b|baking sheet|baking dish|baking pan|cake pan|loaf pan|tart pan|pie dish|casserole|roasting pan/i },
  { key: "whisk", pattern: /\bwhisk|\bbeat\b|\bbeat (?:the|in|until)|\bwhip/i },
  { key: "bowl", pattern: /\bbowl\b|\btoss\b|\bcombine\b|\bmix\b|\bstir together/i },
  { key: "knife", pattern: /\bchop|\bdice|\bslice|\bmince|\bcut\b|\bjulienne/i },
  { key: "grater", pattern: /\bgrate|\bzest\b|\bgrated\b/i },
  { key: "strainer", pattern: /\bdrain|\bstrain|\bsieve|colander|\bsift/i },
  { key: "rollingPin", pattern: /roll (?:it |them |the dough )?out|rolling pin|roll (?:each|into a thin)/i },
];

export function detectEquipment(stepTexts: string[]): EquipmentKey[] {
  const text = stepTexts.join("\n");
  return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.key);
}
