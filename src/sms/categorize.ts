import type { Category, Transaction } from '../db/types';

// Merchant keywords → the seeded category they usually belong to.
const RULES: [RegExp, RegExp][] = [
  [/carrefour|spinneys|hyper|market|grocer|seoudi|gourmet|metro|kheir zaman|oscar|lulu|panda|danube|كارفور|سوبر|ماركت/i, /grocer/i],
  [/uber|careem|swvl|indrive|didi|taxi|petrol|fuel|gas station|wataniya|mobil|shell|total|chillout|metro card|بنزين|وقود/i, /transport/i],
  [/restaurant|cafe|coffee|starbucks|costa|mcdonald|kfc|burger|pizza|talabat|elmenus|breadfast|cilantro|deliveroo|مطعم|كافيه/i, /dining/i],
  [/pharma|pharmacy|hospital|clinic|lab|seif|el ezaby|19011|صيدلية|مستشفى/i, /health/i],
  [/netflix|spotify|apple\.com|itunes|google|youtube|shahid|osn|anghami|icloud|microsoft|adobe|chatgpt|openai/i, /subscri/i],
  [/amazon|noon|jumia|zara|h&m|ikea|mall|store|shop|centrepoint|max fashion|دي فاكتو/i, /shopping/i],
  [/vodafone|orange|etisalat|\bwe\b|telecom|electric|water|gas bill|internet|فودافون|اورنج|اتصالات|كهرباء/i, /utilit/i],
];

export function guessCategory(
  merchant: string | null,
  categories: Category[],
  history: Transaction[]
): string | null {
  const expenseCats = categories.filter((c) => c.kind !== 'income');
  if (merchant) {
    const m = merchant.toLowerCase();
    // Reuse whatever category this merchant got last time.
    const past = history.find((t) => t.type === 'expense' && t.category_id && t.note?.toLowerCase() === m);
    if (past) return past.category_id;
    for (const [pattern, catName] of RULES) {
      if (pattern.test(merchant)) {
        const cat = expenseCats.find((c) => catName.test(c.name));
        if (cat) return cat.id;
      }
    }
  }
  return expenseCats.find((c) => /^other$/i.test(c.name))?.id ?? null;
}
