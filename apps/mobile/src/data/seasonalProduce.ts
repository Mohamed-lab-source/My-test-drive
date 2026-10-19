/**
 * What's in season in Egyptian markets, month by month (0 = January). Names
 * match the ingredient catalog in each language so they can be turned into
 * ingredient ids for recipe lookups.
 */
export type Produce = { en: string; ar: string; emoji: string };

const P = {
  orange: { en: "Orange", ar: "برتقال", emoji: "🍊" },
  strawberries: { en: "Strawberries", ar: "فراولة", emoji: "🍓" },
  cauliflower: { en: "Cauliflower", ar: "قرنبيط", emoji: "🥦" },
  cabbage: { en: "Cabbage", ar: "كرنب", emoji: "🥬" },
  spinach: { en: "Spinach", ar: "سبانخ", emoji: "🥬" },
  carrot: { en: "Carrot", ar: "جزر", emoji: "🥕" },
  leeks: { en: "Leeks", ar: "كراث", emoji: "🧅" },
  fava: { en: "Fava Beans", ar: "فول", emoji: "🫘" },
  lemon: { en: "Lemon", ar: "ليمون", emoji: "🍋" },
  sweetPotato: { en: "Sweet Potato", ar: "بطاطا حلوة", emoji: "🍠" },
  pomegranate: { en: "Pomegranate Seeds", ar: "حب رمان", emoji: "🍎" },
  dill: { en: "Dill", ar: "شبت", emoji: "🌿" },
  parsley: { en: "Parsley", ar: "بقدونس", emoji: "🌿" },
  greenBeans: { en: "Green Beans", ar: "فاصوليا خضراء", emoji: "🫛" },
  zucchini: { en: "Zucchini", ar: "كوسة", emoji: "🥒" },
  cucumber: { en: "Cucumber", ar: "خيار", emoji: "🥒" },
  springOnion: { en: "Spring Onion", ar: "بصل أخضر", emoji: "🧅" },
  potato: { en: "Potato", ar: "بطاطس", emoji: "🥔" },
  mango: { en: "Mango", ar: "مانجو", emoji: "🥭" },
  okra: { en: "Okra", ar: "بامية", emoji: "🌶️" },
  molokhia: { en: "Molokhia (chopped, frozen)", ar: "ملوخية مفرومة مجمدة", emoji: "🌿" },
  eggplant: { en: "Eggplant", ar: "باذنجان", emoji: "🍆" },
  tomato: { en: "Tomato", ar: "طماطم", emoji: "🍅" },
  bellPepper: { en: "Bell Pepper", ar: "فلفل رومي", emoji: "🫑" },
  corn: { en: "Corn", ar: "ذرة", emoji: "🌽" },
  mint: { en: "Mint", ar: "نعناع", emoji: "🌱" },
  basil: { en: "Basil Leaves", ar: "ورق ريحان", emoji: "🌱" },
  dates: { en: "Dates", ar: "تمر", emoji: "🌴" },
  pumpkin: { en: "Pumpkin", ar: "يقطين", emoji: "🎃" },
} satisfies Record<string, Produce>;

const WINTER = [P.orange, P.strawberries, P.cauliflower, P.cabbage, P.spinach, P.carrot, P.leeks, P.lemon, P.sweetPotato, P.dill, P.parsley];
const SPRING = [P.strawberries, P.fava, P.greenBeans, P.zucchini, P.cucumber, P.springOnion, P.potato, P.carrot, P.lemon, P.dill];
const SUMMER = [P.mango, P.okra, P.molokhia, P.eggplant, P.zucchini, P.tomato, P.bellPepper, P.cucumber, P.corn, P.mint, P.basil];
const AUTUMN = [P.dates, P.pomegranate, P.mango, P.pumpkin, P.sweetPotato, P.okra, P.eggplant, P.corn, P.bellPepper, P.tomato, P.lemon];

const BY_MONTH: Produce[][] = [
  WINTER, // Jan
  WINTER, // Feb
  SPRING, // Mar
  SPRING, // Apr
  SPRING, // May
  SUMMER, // Jun
  SUMMER, // Jul
  SUMMER, // Aug
  AUTUMN, // Sep
  AUTUMN, // Oct
  [...AUTUMN.filter((p) => p !== P.mango && p !== P.okra), P.orange, P.cauliflower], // Nov
  WINTER.concat([P.pomegranate]), // Dec
];

export function inSeason(month = new Date().getMonth()): Produce[] {
  return BY_MONTH[month] ?? [];
}
