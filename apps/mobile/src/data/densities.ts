/** Grams in one US cup (236.6 ml), spooned and levelled -- typical kitchen values, not lab figures. */
export type DensityIngredient = { key: string; en: string; ar: string; gramsPerCup: number };

export const DENSITIES: DensityIngredient[] = [
  { key: "flour", en: "Flour", ar: "دقيق", gramsPerCup: 125 },
  { key: "sugar", en: "Sugar", ar: "سكر", gramsPerCup: 200 },
  { key: "brownSugar", en: "Brown sugar", ar: "سكر بني", gramsPerCup: 220 },
  { key: "powderedSugar", en: "Powdered sugar", ar: "سكر بودرة", gramsPerCup: 120 },
  { key: "rice", en: "Rice (raw)", ar: "أرز (نيء)", gramsPerCup: 185 },
  { key: "lentils", en: "Lentils (dry)", ar: "عدس (جاف)", gramsPerCup: 190 },
  { key: "bulgur", en: "Bulgur", ar: "برغل", gramsPerCup: 160 },
  { key: "semolina", en: "Semolina", ar: "سميد", gramsPerCup: 167 },
  { key: "oats", en: "Rolled oats", ar: "شوفان", gramsPerCup: 90 },
  { key: "cocoa", en: "Cocoa powder", ar: "كاكاو بودرة", gramsPerCup: 85 },
  { key: "butter", en: "Butter / ghee", ar: "زبدة / سمن", gramsPerCup: 227 },
  { key: "oil", en: "Oil", ar: "زيت", gramsPerCup: 218 },
  { key: "water", en: "Water", ar: "ماء", gramsPerCup: 237 },
  { key: "milk", en: "Milk", ar: "حليب", gramsPerCup: 245 },
  { key: "yogurt", en: "Yogurt", ar: "زبادي", gramsPerCup: 245 },
  { key: "honey", en: "Honey / molasses", ar: "عسل / عسل أسود", gramsPerCup: 340 },
  { key: "tahini", en: "Tahini", ar: "طحينة", gramsPerCup: 240 },
  { key: "nuts", en: "Chopped nuts", ar: "مكسرات مفرومة", gramsPerCup: 120 },
];
