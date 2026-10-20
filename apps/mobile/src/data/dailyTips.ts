/** One tip a day on Home, rotating by day of the year. */
export const DAILY_TIPS: { en: string; ar: string }[] = [
  { en: "Salt pasta water until it tastes like the sea -- it's the only chance to season the pasta itself.", ar: "ملّحي ماء المكرونة حتى يصبح طعمه كماء البحر -- إنها الفرصة الوحيدة لتتبيل المكرونة نفسها." },
  { en: "Rinse rice until the water runs clear for fluffier, separate grains.", ar: "اغسلي الأرز حتى يصبح الماء صافياً لتحصلي على حبات منفصلة وهشة." },
  { en: "Let meat rest 5-10 minutes after cooking so the juices settle instead of running onto the board.", ar: "اتركي اللحم يرتاح 5-10 دقائق بعد الطهي لتستقر العصارة بدل أن تسيل على اللوح." },
  { en: "Don't crowd the pan: food steams instead of browning when it's packed too tightly.", ar: "لا تزحمي المقلاة: الطعام يُطهى بالبخار بدل أن يتحمر إذا كان مكدساً." },
  { en: "Toast whole spices in a dry pan for a minute to wake up their flavour.", ar: "حمّصي التوابل الكاملة في مقلاة جافة لدقيقة لتنشيط نكهتها." },
  { en: "A squeeze of lemon at the end brightens almost any stew, soup or salad.", ar: "عصرة ليمون في النهاية تنعش تقريباً أي طاجن أو شوربة أو سلطة." },
  { en: "Keep herbs like parsley and coriander in a glass of water in the fridge -- they last days longer.", ar: "احفظي الأعشاب مثل البقدونس والكزبرة في كوب ماء داخل الثلاجة -- تدوم أياماً أطول." },
  { en: "Cook onions low and slow for real sweetness; rushing them on high heat just burns the edges.", ar: "اطهي البصل على نار هادئة وببطء ليكتسب حلاوة حقيقية؛ النار العالية تحرق الأطراف فقط." },
  { en: "Read the whole recipe before you start -- surprises like 'marinate overnight' hide at the end.", ar: "اقرئي الوصفة كاملة قبل البدء -- مفاجآت مثل \"تتبل طوال الليل\" تختبئ في النهاية." },
  { en: "Freeze leftover tomato paste in spoonfuls on a tray, then bag them for later.", ar: "جمّدي صلصة الطماطم المتبقية بالملاعق على صينية، ثم ضعيها في كيس لوقت لاحق." },
  { en: "Pat chicken and fish dry before cooking for a golden, crisp surface.", ar: "جففي الدجاج والسمك جيداً قبل الطهي لسطح ذهبي ومقرمش." },
  { en: "Taste as you go: adjust salt and acid in small steps, not all at the end.", ar: "تذوقي أثناء الطهي: عدّلي الملح والحموضة على مراحل صغيرة، لا كلها في النهاية." },
  { en: "Soak dried beans and chickpeas overnight to cut cooking time and make them easier to digest.", ar: "انقعي الفول والحمص الجاف طوال الليل لتقليل وقت الطهي وتسهيل الهضم." },
  { en: "Sharp knives are safer than dull ones -- they cut where you aim instead of slipping.", ar: "السكاكين الحادة أكثر أماناً من الباهتة -- تقطع حيث تريدين بدل أن تنزلق." },
  { en: "Add garlic after the onions soften; it burns fast and turns bitter.", ar: "أضيفي الثوم بعد أن يذبل البصل؛ فهو يحترق بسرعة ويصبح مراً." },
  { en: "Save a cup of pasta water -- its starch helps sauces cling and turn silky.", ar: "احتفظي بكوب من ماء المكرونة -- النشا فيه يساعد الصوص على التماسك ويجعله ناعماً." },
  { en: "Buy produce in season: it's cheaper at the market and tastes better.", ar: "اشتري الخضار والفاكهة في موسمها: أرخص في السوق وأطيب طعماً." },
  { en: "Plan two meals that share ingredients so nothing in the fridge goes to waste.", ar: "خططي لوجبتين تشتركان في المكونات حتى لا يُهدر شيء في الثلاجة." },
  { en: "Let your pan heat up before adding oil and food -- it prevents sticking.", ar: "اتركي المقلاة تسخن قبل إضافة الزيت والطعام -- يمنع ذلك الالتصاق." },
  { en: "Cool leftovers quickly and refrigerate within 2 hours to keep them safe.", ar: "بردي بقايا الطعام بسرعة وضعيها في الثلاجة خلال ساعتين لتبقى آمنة." },
  { en: "A pinch of sugar balances acidic tomato sauces without making them sweet.", ar: "رشة سكر توازن حموضة صوص الطماطم دون أن تجعله حلواً." },
];

export function tipOfTheDay(date = new Date()): { en: string; ar: string } {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
}
