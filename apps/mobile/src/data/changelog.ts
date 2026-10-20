export type ChangelogEntry = {
  id: string;
  date: string;
  title: { en: string; ar: string };
  body: { en: string; ar: string };
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "2026-10-asian-recipes",
    date: "2026-10-20",
    title: { en: "332 Indian, Chinese, Japanese, Thai and Korean recipes", ar: "332 وصفة هندية وصينية ويابانية وتايلاندية وكورية" },
    body: {
      en: "Now 1,641 recipes and four new cuisines. Indian biryanis, curries, dals, chaat, breads and sweets; Chinese stir-fries, dumplings, noodles and halal Xinjiang dishes; Japanese katsu, donburi, sushi rolls, ramen and wagashi; Thai curries, noodles, salads and street desserts; and Korean barbecue, fried chicken, stews, kimchi and banchan. All halal-friendly: no pork, wine, sake or mirin.",
      ar: "أصبح لدينا 1641 وصفة وأربعة مطابخ جديدة. البرياني والكاري والدال والتشات والخبز والحلويات الهندية؛ والأطباق الصينية المقلّبة والزلابية والنودلز وأطباق شينجيانغ الحلال؛ والكاتسو والدونبوري ولفائف السوشي والرامن والحلويات اليابانية؛ والكاري والنودلز والسلطات وحلويات الشارع التايلاندية؛ والشواء والدجاج المقلي واليخنات والكيمتشي والأطباق الجانبية الكورية. كلها حلال بدون لحم خنزير أو نبيذ أو ساكي أو ميرين.",
    },
  },
  {
    id: "2026-10-european-recipes",
    date: "2026-10-19",
    title: { en: "383 Italian, French, Greek, Spanish and Mediterranean recipes", ar: "383 وصفة إيطالية وفرنسية ويونانية وإسبانية ومتوسطية" },
    body: {
      en: "Now 1,309 recipes and two new cuisines. Italian regional pastas, risotto, pizza and dolci; French bistro classics, Provençal dishes, pâtisserie and crêpes; Greek stifado, ladera, filo pies and syrup cakes; Spanish paella, tapas, gazpacho and churros; and Mediterranean bowls plus dishes from Cyprus, Malta, the Adriatic and Portugal. Everything is halal-friendly, with no pork or alcohol.",
      ar: "أصبح لدينا 1309 وصفة ومطبخان جديدان. معكرونة الأقاليم الإيطالية والريزوتو والبيتزا والحلويات؛ وكلاسيكيات البيسترو الفرنسية وأطباق بروفانس والمعجنات والكريب؛ والستيفادو اليوناني وأطباق زيت الزيتون وفطائر الفيلو وكيك الشربات؛ والباييا الإسبانية والتاباس والجازباتشو والتشوروس؛ وأطباق متوسطية صحية وأكلات من قبرص ومالطا والأدرياتيكي والبرتغال. كلها حلال بدون لحم خنزير أو كحول.",
    },
  },
  {
    id: "2026-10-maghreb-turkish-persian",
    date: "2026-10-19",
    title: { en: "235 Moroccan, Tunisian, Turkish and Persian recipes", ar: "235 وصفة مغربية وتونسية وتركية وإيرانية" },
    body: {
      en: "Now 926 recipes. Moroccan tagines, couscous, pastilla, chebakia and gazelle horns; Tunisian lablabi, brik, ojja and makroudh; Turkish kebabs, mantı, pilafs, meze, künefe and Turkish coffee; and Persian ghormeh sabzi, fesenjan, tahdig, jewelled rice, kababs and saffron sweets.",
      ar: "أصبح لدينا 926 وصفة. طواجن وكسكس وبسطيلة وشباكية وكعب الغزال من المغرب؛ ولبلابي وبريك وعجة ومقروض من تونس؛ وكباب ومانتي وبيلاف ومزات وكنافة وقهوة تركية من تركيا؛ وقورمه سبزي وفسنجان وته‌ديگ والرز المرصع والكباب وحلويات الزعفران من إيران.",
    },
  },
  {
    id: "2026-10-arab-world-recipes",
    date: "2026-10-19",
    title: { en: "286 recipes from across the Arab world", ar: "286 وصفة من كل العالم العربي" },
    body: {
      en: "Now 691 recipes and four new cuisines. Levantine: kibbeh of every kind, mansaf, musakhan, fatteh, ma'amoul and knafeh-shop sweets. Gulf: kabsa, machboos, mandi, harees, luqaimat and Arabic coffee. Plus Iraqi (masgouf, dolma, kleicha), Yemeni (saltah, fahsa, bint al sahn) and Sudanese (ful, mullah, dakwa) kitchens. The built-in catalog is also 40% smaller, so the app stays quick.",
      ar: "أصبح لدينا 691 وصفة وأربعة مطابخ جديدة. الشامي: الكبة بكل أنواعها والمنسف والمسخن والفتة والمعمول وحلويات الكنافة. الخليجي: الكبسة والمجبوس والمندي والهريس واللقيمات والقهوة العربية. ومعها المطبخ العراقي (المسكوف والدولمة والكليجة) واليمني (السلتة والفحسة وبنت الصحن) والسوداني (الفول والملاح والدكوة). كما صار الكتالوج المدمج أصغر بنسبة 40% ليبقى التطبيق سريعاً.",
    },
  },
  {
    id: "2026-10-egyptian-recipes",
    date: "2026-10-19",
    title: { en: "185 new Egyptian recipes", ar: "185 وصفة مصرية جديدة" },
    body: {
      en: "The catalog nearly doubles to 405 recipes: ful and ta'ameya variations, mahshi of every kind, molokhia, fattah, Alexandrian seafood, tabikh stews, béchamel bakes, Eid kahk and ghorayeba, Ramadan qatayef and kunafa, street drinks like sobia and karkade, and lighter 'fit' takes on the classics. Every one has costs, nutrition and Arabic steps, and works offline.",
      ar: "تضاعف الكتالوج تقريباً إلى 405 وصفة: أنواع الفول والطعمية، المحشي بكل أشكاله، الملوخية، الفتة، مأكولات الإسكندرية البحرية، الطبيخ، صواني البشاميل، كحك وغريبة العيد، قطايف وكنافة رمضان، مشروبات الشارع مثل السوبيا والكركديه، ونسخ خفيفة من الأطباق الكلاسيكية. كلها بالتكلفة والقيم الغذائية وخطوات بالعربية وتعمل بدون إنترنت.",
    },
  },
  {
    id: "2026-10-bundled-catalog",
    date: "2026-10-19",
    title: { en: "All recipes work offline", ar: "كل الوصفات تعمل بدون إنترنت" },
    body: {
      en: "All 220 recipes now come built into the app. Browsing, search, filters, recipe pages, Cook Mode, pantry matching and shopping lists keep working even when you're offline or the Cookmate server is down.",
      ar: "كل الوصفات الـ220 مدمجة الآن في التطبيق. التصفح والبحث والفلاتر وصفحات الوصفات ووضع الطبخ ومطابقة المخزن وقوائم التسوق تعمل حتى بدون إنترنت أو عند توقف خادم Cookmate.",
    },
  },
  {
    id: "2026-10-guides-fasting",
    date: "2026-10-19",
    title: { en: "Kitchen guides & fasting tracker", ar: "أدلة المطبخ ومتابعة الصيام" },
    body: {
      en: "Cooking basics, a food storage guide and spice blends in Kitchen Guides; cups-to-grams in the Unit Converter; a fasting tracker for intermittent and Ramadan fasts; and in the food diary, one-tap re-logging, copy the day before, and a shareable weekly report.",
      ar: "أساسيات الطبخ ودليل حفظ الطعام وخلطات التوابل في أدلة المطبخ؛ تحويل الأكواب إلى جرامات في محوّل الوحدات؛ متابعة الصيام المتقطع وصيام رمضان؛ وفي يوميات الطعام إعادة التسجيل بضغطة ونسخ اليوم السابق وتقرير أسبوعي قابل للمشاركة.",
    },
  },
  {
    id: "2026-10-reports",
    date: "2026-10-19",
    title: { en: "Report a recipe problem & cuisine averages", ar: "الإبلاغ عن مشكلة ومتوسطات المطابخ" },
    body: {
      en: "Flag wrong amounts, unclear steps or translation slips from any recipe page. The cuisine explorer now shows each cuisine's average cost, calories and cooking time.",
      ar: "أبلغي عن المقادير الخاطئة أو الخطوات غير الواضحة أو أخطاء الترجمة من أي صفحة وصفة. ويعرض مستكشف المطابخ الآن متوسط التكلفة والسعرات ووقت الطهي لكل مطبخ.",
    },
  },
  {
    id: "2026-10-settings",
    date: "2026-10-19",
    title: { en: "Settings, backup & quiet hours", ar: "الإعدادات والنسخ الاحتياطي وساعات الهدوء" },
    body: {
      en: "A new Settings page: every reminder in one place with a test notification, quiet hours, high contrast, Arabic-Indic numerals, your choice of start tab, backup and restore, cache clearing, feedback and an About page. Plus an offline banner.",
      ar: "صفحة إعدادات جديدة: كل التذكيرات في مكان واحد مع إشعار تجريبي، وساعات الهدوء، والتباين العالي، والأرقام العربية الهندية، واختيار تبويب البداية، والنسخ الاحتياطي والاستعادة، ومسح الذاكرة المؤقتة، والملاحظات، وصفحة عن التطبيق. بالإضافة إلى شريط عدم الاتصال.",
    },
  },
  {
    id: "2026-10-goals",
    date: "2026-10-19",
    title: { en: "Goals, passport & more badges", ar: "الأهداف والجواز وشارات أكثر" },
    body: {
      en: "Set a weekly cooking goal, take the weekly new-cuisine challenge, and protect your streak with a weekly freeze. Plus a cuisine passport, a monthly recap with money saved, a tip of the day, 8 new badges, and sharing for your achievements.",
      ar: "حددي هدفاً أسبوعياً للطبخ، وخوضي تحدي المطبخ الجديد كل أسبوع، واحمي سلسلتك بتجميد أسبوعي. بالإضافة إلى جواز سفر المطابخ، وملخص شهري مع ما وفّرتِه، ونصيحة يومية، و8 شارات جديدة، ومشاركة إنجازاتك.",
    },
  },
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
