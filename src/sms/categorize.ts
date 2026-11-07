import type { Category, Transaction } from '../db/types';

// Merchant keywords → the seeded category they usually belong to.
const RULES: [RegExp, RegExp][] = [
  // Egyptian chains and services first, so they win over the general words below.
  [/kazyon|fathalla|awlad ragab|ragab sons|\bbim\b|othaim|zahran|abu auf|el mahalawy|خير زمان|كازيون|فتح الله/i, /grocer/i],
  [/koshary|abou tarek|mo'?men|cook door|buffalo|zooba|bazooka|el tahrir|hardee|tim hortons|espresso lab|beano|cinnabon|كشري|مؤمن/i, /dining/i],
  [/gobus|go bus|blue ?bus|webus|egyptair|air cairo|nile air|halan|bolt|ticketsmarche|ترانزيت|جو باص/i, /transport/i],
  [/fawry|wepay|we pay|telecom egypt|natural gas|town gas|petrotrade|فوري|غاز/i, /utilit/i],
  [/watch ?it|yango|beinsports|bein|tod tv|tod\b|شاهد/i, /subscri/i],
  [/b\.?tech|\b2b\b|raya|dubai phone|lc waikiki|town team|defacto|sephora|bath & body|virgin megastore|بي تك|راية/i, /shopping/i],
  [/misr pharm|roshdy|alfa lab|al borg|el mokhtabar|cleopatra hosp|andalusia|dar al fouad|as-salam|vezeeta|رشدي|المختبر|البرج/i, /health/i],
  [/uber\s*eats|talabat|elmenus|breadfast|deliveroo/i, /dining/i],
  [/carrefour|spinneys|hyper|market|grocer|\bsupe|seoudi|gourmet|metro|kheir zaman|oscar|lulu|panda|danube|كارفور|سوبر|ماركت/i, /grocer/i],
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
