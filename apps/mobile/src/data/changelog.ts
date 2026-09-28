export type ChangelogEntry = {
  id: string;
  date: string;
  title: { en: string; ar: string };
  body: { en: string; ar: string };
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
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
