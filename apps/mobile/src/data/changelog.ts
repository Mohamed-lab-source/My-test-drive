export type ChangelogEntry = {
  id: string;
  date: string;
  title: { en: string; ar: string };
  body: { en: string; ar: string };
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "2026-10-cook-mode",
    date: "2026-10-19",
    title: { en: "Cook Mode upgrades & cooking journal", ar: "تحسينات وضع الطبخ ودفتر الطبخ" },
    body: {
      en: "Multiple timers that keep running (with notifications), a standalone kitchen timer, bigger text, swipe between steps, a done-by estimate, oven preheat reminders, servings scaling, step notes, and a cooking journal you can export.",
      ar: "مؤقتات متعددة تستمر بالعمل (مع إشعارات)، ومؤقت مطبخ مستقل، ونص أكبر، والتنقل بالسحب بين الخطوات، وتقدير موعد الانتهاء، وتذكير بتسخين الفرن، وتغيير المقادير، وملاحظات للخطوات، ودفتر طبخ يمكن تصديره.",
    },
  },
  {
    id: "2026-10-discover",
    date: "2026-10-19",
    title: { en: "Discover", ar: "اكتشفي" },
    body: {
      en: "A new Discover hub: surprise recipes within your budget, what's in season in Egypt this month, a cuisine explorer, and hidden recipes. Lists gain in-season, high-protein, max-calorie and lowest-calorie options, and Home suggests dishes because you liked one.",
      ar: "مركز \"اكتشفي\" الجديد: وصفات مفاجئة ضمن ميزانيتك، وما في موسمه في مصر هذا الشهر، ومستكشف المطابخ، والوصفات المخفية. القوائم تضيف فلاتر الموسم والبروتين وحد السعرات والأقل سعرات، والرئيسية تقترح أطباقاً لأنك أحببتِ طبقاً.",
    },
  },
  {
    id: "2026-10-household",
    date: "2026-10-19",
    title: { en: "Cook for your household", ar: "اطبخي لعائلتك" },
    body: {
      en: "Add family members with their allergies, open recipes scaled to your household, pick who's eating, and get warned when a dish isn't safe for someone. Plus lunchbox ideas, a party planner, recipe comparison, a kid-friendly filter, family WhatsApp votes and friend invites.",
      ar: "أضيفي أفراد العائلة وحساسياتهم، وافتحي الوصفات بمقادير تناسب عائلتك، واختاري من سيأكل، واحصلي على تنبيه عندما يكون الطبق غير آمن لأحدهم. بالإضافة إلى أفكار علبة الغداء، ومخطط العزومة، ومقارنة الوصفات، وفلتر الأطفال، وتصويت العائلة على واتساب، ودعوة الصديقات.",
    },
  },
  {
    id: "2026-10-pantry",
    date: "2026-10-19",
    title: { en: "My pantry & smarter shopping lists", ar: "مخزني وقوائم تسوق أذكى" },
    body: {
      en: "Track what's in your kitchen and it's ticked off on every shopping list. Lists now sort by aisle or A-Z, hide what you have, tick whole aisles, take extra items, show progress and what's left to spend, and share to WhatsApp.",
      ar: "تابعي ما في مطبخك ليُؤشَّر تلقائياً في كل قائمة تسوق. القوائم الآن تُرتَّب حسب القسم أو أبجدياً، وتخفي ما لديكِ، وتؤشّر أقساماً كاملة، وتقبل عناصر إضافية، وتعرض التقدم وما تبقى للإنفاق، وتُشارك على واتساب.",
    },
  },
  {
    id: "2026-10-recipe-page",
    date: "2026-10-19",
    title: { en: "A smarter recipe page", ar: "صفحة وصفة أذكى" },
    body: {
      en: "Ready-by time, a kitchen tools list, last-cooked date, an ingredient checklist with one-tap copy, nutrition and cost for your serving count, high-protein and low-calorie badges, your rating on cards, and WhatsApp sharing with your notes.",
      ar: "وقت الجاهزية، وقائمة أدوات المطبخ، وتاريخ آخر طبخ، وقائمة مكونات للتأشير مع نسخ بضغطة، والتغذية والتكلفة لعدد الحصص، وشارات غني بالبروتين وقليل السعرات، وتقييمك على البطاقات، ومشاركة على واتساب مع ملاحظاتك.",
    },
  },
  {
    id: "2026-10-food-diary",
    date: "2026-10-18",
    title: { en: "Food diary & nutrition tracking", ar: "يوميات الطعام ومتابعة التغذية" },
    body: {
      en: "Log what you eat from any recipe or after Cook Mode, quick-add anything else, track water and protein, and see a weekly report against your Meal Prep calorie target. Today's numbers now show on Home.",
      ar: "سجّلي ما تأكلينه من أي وصفة أو بعد وضع الطبخ، وأضيفي سريعاً أي شيء آخر، وتابعي الماء والبروتين، وشاهدي تقريراً أسبوعياً مقارنة بهدف السعرات من تحضير الوجبات. أرقام اليوم تظهر الآن في الرئيسية.",
    },
  },
  {
    id: "2026-10-meal-prep",
    date: "2026-10-13",
    title: { en: "Meal Prep Planner", ar: "مخطط تحضير الوجبات" },
    body: {
      en: "Build a week of 3 meals a day from the cuisines you love, within your budget, with the calories of every meal worked out -- in a calorie deficit if you like, with a free day and a cheat meal, plus a batch-cook list for prep day.",
      ar: "جهّزي أسبوعاً من 3 وجبات يومياً من المطابخ التي تحبينها وضمن ميزانيتك، مع حساب سعرات كل وجبة -- بعجز في السعرات إن أردتِ، مع يوم حر ووجبة حرة، وقائمة طبخ مسبق ليوم التحضير.",
    },
  },
  {
    id: "2026-09-discovery",
    date: "2026-09-28",
    title: { en: "Trending & substitution finder", ar: "الرائج وبديل المكونات" },
    body: {
      en: "See what's trending this week on Home, filter recipes with 6 ingredients or fewer, and look up a common substitute for any ingredient.",
      ar: "شاهدي الرائج هذا الأسبوع في الرئيسية، صفّي الوصفات ذات ٦ مكونات أو أقل، وابحثي عن بديل شائع لأي مكوّن.",
    },
  },
  {
    id: "2026-09-planning",
    date: "2026-09-28",
    title: { en: "Cooking calendar & budget cap", ar: "تقويم الطبخ وسقف الميزانية" },
    body: {
      en: "A monthly calendar shows your planned and actually-cooked days, repeat last week's plan in one tap, share your weekly plan as text, set a weekly grocery budget cap, and pantry checkmarks now persist across regenerated lists.",
      ar: "تقويم شهري يعرض أيامك المخططة والتي طبخت فيها فعلاً، كرّري خطة الأسبوع الماضي بلمسة واحدة، شاركي خطتك الأسبوعية كنص، حددي سقف ميزانية أسبوعية للبقالة، وعلامات البقالة الآن تبقى محفوظة عند إعادة إنشاء القائمة.",
    },
  },
  {
    id: "2026-09-engagement",
    date: "2026-09-25",
    title: { en: "My Reviews & rating breakdown", ar: "تقييماتي وتوزيع التقييمات" },
    body: {
      en: "Browse every recipe you've rated in one place, see a star-by-star rating breakdown on recipe pages, get a gentle nudge to rate after Cook Mode, and undo an accidental removal of a leftover or recently-viewed recipe.",
      ar: "تصفحي كل وصفة قيّمتِها في مكان واحد، شاهدي توزيع التقييمات نجمة بنجمة في صفحات الوصفات، احصلي على تذكير لطيف للتقييم بعد وضع الطبخ، وتراجعي عن حذف طبق متبقٍ أو وصفة تمت مشاهدتها مؤخراً بالخطأ.",
    },
  },
  {
    id: "2026-09-personalization",
    date: "2026-09-25",
    title: { en: "Accent colors & text size", ar: "ألوان مميزة وحجم النص" },
    body: {
      en: "Pick an accent color for the app in Profile, choose a comfortable text size for recipe steps and ingredients, and enjoy improved accessibility labels throughout.",
      ar: "اختاري لوناً مميزاً للتطبيق من الملف الشخصي، حددي حجم نص مريح لخطوات ومكونات الوصفات، واستمتعي بتحسينات في إمكانية الوصول في كل مكان.",
    },
  },
  {
    id: "2026-09-reliability",
    date: "2026-09-25",
    title: { en: "Pull-to-refresh & offline fallback", ar: "السحب للتحديث والعمل دون اتصال" },
    body: {
      en: "Pull to refresh on recipe lists and detail pages, Pantry Finder now remembers your selected ingredients, and Home shows your last-known results instead of a stuck spinner when offline.",
      ar: "اسحبي للتحديث في قوائم الوصفات وصفحات التفاصيل، أداة إيجاد وصفات المخزن الآن تتذكر المكونات المختارة، والرئيسية تعرض آخر نتائج معروفة بدلاً من دائرة تحميل عالقة عند انقطاع الاتصال.",
    },
  },
  {
    id: "2026-09-lean-muscle",
    date: "2026-09-20",
    title: { en: "Lean & Muscle Mode", ar: "وضع اللياقة والعضلات" },
    body: {
      en: "A smart week generator builds a full 7-day meal plan tuned to your calorie and protein targets.",
      ar: "مولّد أسبوعي ذكي ينشئ خطة وجبات كاملة لسبعة أيام مصممة لأهدافك من السعرات والبروتين.",
    },
  },
];
