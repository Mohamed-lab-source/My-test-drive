type Bi = { en: string; ar: string };

/** How to cook the everyday basics: ratio, time and the one tip that matters. */
export const COOKING_BASICS: { emoji: string; title: Bi; steps: Bi[] }[] = [
  {
    emoji: "🍚",
    title: { en: "Egyptian white rice", ar: "الأرز الأبيض المصري" },
    steps: [
      { en: "Rinse 1 cup rice until the water runs clear, drain well.", ar: "اغسلي كوب أرز حتى يصفو الماء وصفّيه جيداً." },
      { en: "Fry in 1 tbsp ghee or oil for 2 minutes (add vermicelli first if you like).", ar: "قلّبيه في ملعقة سمن أو زيت لدقيقتين (أضيفي الشعرية أولاً إن أحببتِ)." },
      { en: "Add 1¼ cups boiling water and a pinch of salt; boil until the surface shows little holes.", ar: "أضيفي كوباً وربع ماء مغلي ورشة ملح، واتركيه يغلي حتى تظهر ثقوب صغيرة على السطح." },
      { en: "Cover, lowest heat, 15 minutes; rest 5 minutes before fluffing.", ar: "غطّيه على أقل نار 15 دقيقة، واتركيه 5 دقائق قبل التقليب." },
    ],
  },
  {
    emoji: "🍝",
    title: { en: "Pasta", ar: "المكرونة" },
    steps: [
      { en: "1 litre water per 100 g pasta, salted like the sea.", ar: "لتر ماء لكل 100 جرام مكرونة، مملّح كماء البحر." },
      { en: "Cook 1 minute less than the packet says, stirring early so it doesn't stick.", ar: "اطبخيها أقل بدقيقة من المكتوب على العبوة، وقلّبي في البداية لكي لا تلتصق." },
      { en: "Save a cup of pasta water before draining -- it makes sauces silky.", ar: "احتفظي بكوب من ماء المكرونة قبل التصفية -- يجعل الصوص ناعماً." },
    ],
  },
  {
    emoji: "🥚",
    title: { en: "Boiled eggs", ar: "البيض المسلوق" },
    steps: [
      { en: "Lower eggs into gently boiling water.", ar: "ضعي البيض برفق في ماء يغلي بهدوء." },
      { en: "6 min soft · 8 min jammy · 10-11 min hard.", ar: "6 دقائق برشت · 8 دقائق نصف سوي · 10-11 دقيقة مسلوق تماماً." },
      { en: "Move to cold water straight away so they peel easily.", ar: "انقليه فوراً إلى ماء بارد ليسهل تقشيره." },
    ],
  },
  {
    emoji: "🫘",
    title: { en: "Lentils", ar: "العدس" },
    steps: [
      { en: "Red/yellow lentils: rinse, 1 cup to 3 cups water, 15-20 minutes until they collapse -- no soaking.", ar: "العدس الأصفر: اغسليه، كوب لثلاثة أكواب ماء، 15-20 دقيقة حتى يذوب -- بدون نقع." },
      { en: "Brown lentils: 1 cup to 3 cups water, 25-30 minutes so they hold their shape (for koshari).", ar: "العدس البني: كوب لثلاثة أكواب ماء، 25-30 دقيقة ليحافظ على شكله (للكشري)." },
      { en: "Salt at the end -- early salt keeps them firm.", ar: "أضيفي الملح في النهاية -- الملح المبكر يبقيه صلباً." },
    ],
  },
  {
    emoji: "🫛",
    title: { en: "Dried fava beans & chickpeas", ar: "الفول والحمص الجاف" },
    steps: [
      { en: "Soak overnight in plenty of water with a pinch of baking soda.", ar: "انقعيهما طوال الليل في ماء وفير مع رشة بيكربونات." },
      { en: "Fava (ful medames): simmer covered 2-3 hours, or 45 minutes in a pressure cooker.", ar: "الفول المدمس: على نار هادئة مغطى 2-3 ساعات، أو 45 دقيقة في حلة الضغط." },
      { en: "Chickpeas: simmer 1-1½ hours, or 25 minutes in a pressure cooker, until creamy inside.", ar: "الحمص: على نار هادئة ساعة إلى ساعة ونصف، أو 25 دقيقة في حلة الضغط، حتى يطرى من الداخل." },
    ],
  },
  {
    emoji: "🥣",
    title: { en: "Couscous & bulgur", ar: "الكسكسي والبرغل" },
    steps: [
      { en: "Couscous: equal volume boiling salted water + a little butter, cover 5 minutes, fluff with a fork.", ar: "الكسكسي: نفس الحجم ماء مغلي مملح مع قليل من الزبدة، غطّيه 5 دقائق ثم فكّكيه بالشوكة." },
      { en: "Fine bulgur (for tabbouleh/kibbeh): soak 15 minutes in cold water, squeeze dry.", ar: "البرغل الناعم (للتبولة والكبة): انقعيه 15 دقيقة في ماء بارد ثم اعصريه." },
      { en: "Coarse bulgur: 1 cup to 2 cups water, simmer covered 12 minutes, rest 10.", ar: "البرغل الخشن: كوب لكوبين ماء، على نار هادئة مغطى 12 دقيقة، ثم يرتاح 10 دقائق." },
    ],
  },
];

/** Safe keeping times; "—" means it doesn't keep well that way. */
export const FOOD_STORAGE: { emoji: string; item: Bi; fridge: Bi; freezer: Bi }[] = [
  { emoji: "🍗", item: { en: "Cooked chicken or meat", ar: "دجاج أو لحم مطبوخ" }, fridge: { en: "3-4 days", ar: "3-4 أيام" }, freezer: { en: "2-3 months", ar: "2-3 أشهر" } },
  { emoji: "🥩", item: { en: "Raw minced meat", ar: "لحم مفروم نيء" }, fridge: { en: "1-2 days", ar: "1-2 يوم" }, freezer: { en: "3-4 months", ar: "3-4 أشهر" } },
  { emoji: "🐔", item: { en: "Raw chicken", ar: "دجاج نيء" }, fridge: { en: "1-2 days", ar: "1-2 يوم" }, freezer: { en: "9 months", ar: "9 أشهر" } },
  { emoji: "🐟", item: { en: "Raw fish", ar: "سمك نيء" }, fridge: { en: "1-2 days", ar: "1-2 يوم" }, freezer: { en: "3-6 months", ar: "3-6 أشهر" } },
  { emoji: "🍚", item: { en: "Cooked rice", ar: "أرز مطبوخ" }, fridge: { en: "3-4 days (cool within 1 hour)", ar: "3-4 أيام (برّديه خلال ساعة)" }, freezer: { en: "1 month", ar: "شهر" } },
  { emoji: "🍲", item: { en: "Soups & stews (molokhia, fasolia...)", ar: "الشوربات والطواجن (ملوخية، فاصوليا...)" }, fridge: { en: "3-4 days", ar: "3-4 أيام" }, freezer: { en: "2-3 months", ar: "2-3 أشهر" } },
  { emoji: "🫘", item: { en: "Cooked ful or beans", ar: "فول أو بقوليات مطبوخة" }, fridge: { en: "3-5 days", ar: "3-5 أيام" }, freezer: { en: "3 months", ar: "3 أشهر" } },
  { emoji: "🥚", item: { en: "Hard-boiled eggs", ar: "بيض مسلوق" }, fridge: { en: "1 week", ar: "أسبوع" }, freezer: { en: "—", ar: "—" } },
  { emoji: "🧀", item: { en: "White cheese (gebna beida) in brine", ar: "جبنة بيضاء في المش" }, fridge: { en: "2-3 weeks", ar: "2-3 أسابيع" }, freezer: { en: "—", ar: "—" } },
  { emoji: "🥛", item: { en: "Opened milk or yogurt", ar: "حليب أو زبادي مفتوح" }, fridge: { en: "5-7 days", ar: "5-7 أيام" }, freezer: { en: "—", ar: "—" } },
  { emoji: "🍞", item: { en: "Baladi bread", ar: "العيش البلدي" }, fridge: { en: "— (goes stale)", ar: "— (يجف)" }, freezer: { en: "1 month", ar: "شهر" } },
  { emoji: "🌿", item: { en: "Fresh herbs", ar: "أعشاب طازجة" }, fridge: { en: "1 week in a glass of water", ar: "أسبوع في كوب ماء" }, freezer: { en: "3 months chopped in oil", ar: "3 أشهر مفرومة في زيت" } },
  { emoji: "🍅", item: { en: "Tomato sauce / paste (opened)", ar: "صلصة طماطم مفتوحة" }, fridge: { en: "5-7 days", ar: "5-7 أيام" }, freezer: { en: "3 months", ar: "3 أشهر" } },
  { emoji: "🥗", item: { en: "Dressed salad", ar: "سلطة متبلة" }, fridge: { en: "1 day", ar: "يوم واحد" }, freezer: { en: "—", ar: "—" } },
  { emoji: "🍰", item: { en: "Cakes & baked sweets", ar: "الكيك والحلويات المخبوزة" }, fridge: { en: "3-5 days", ar: "3-5 أيام" }, freezer: { en: "2-3 months", ar: "2-3 أشهر" } },
];

/** Classic spice mixes, in parts by volume, so they scale to any jar. */
export const SPICE_BLENDS: { emoji: string; name: Bi; use: Bi; parts: Bi[] }[] = [
  {
    emoji: "🌶️",
    name: { en: "Egyptian baharat", ar: "البهارات المصرية" },
    use: { en: "Mahshi, meat, rice, stews", ar: "المحشي واللحوم والأرز والطواجن" },
    parts: [
      { en: "2 black pepper", ar: "2 فلفل أسود" },
      { en: "2 cumin", ar: "2 كمون" },
      { en: "2 coriander", ar: "2 كزبرة ناشفة" },
      { en: "1 cinnamon", ar: "1 قرفة" },
      { en: "1 allspice", ar: "1 بهار حلو" },
      { en: "½ nutmeg", ar: "½ جوزة الطيب" },
      { en: "½ cardamom", ar: "½ حبهان" },
    ],
  },
  {
    emoji: "🥜",
    name: { en: "Dukkah", ar: "الدقة" },
    use: { en: "Bread dipped in olive oil, eggs, salads", ar: "مع العيش وزيت الزيتون، والبيض، والسلطات" },
    parts: [
      { en: "4 toasted sesame", ar: "4 سمسم محمص" },
      { en: "2 toasted coriander seeds", ar: "2 بذور كزبرة محمصة" },
      { en: "1 toasted cumin", ar: "1 كمون محمص" },
      { en: "2 toasted hazelnuts or peanuts, crushed", ar: "2 بندق أو سوداني محمص مجروش" },
      { en: "½ salt, ½ black pepper", ar: "½ ملح، ½ فلفل أسود" },
    ],
  },
  {
    emoji: "🌿",
    name: { en: "Za'atar", ar: "الزعتر" },
    use: { en: "Man'oushe, labneh, roast vegetables", ar: "المناقيش واللبنة والخضار المشوية" },
    parts: [
      { en: "4 dried thyme", ar: "4 زعتر مجفف" },
      { en: "2 sumac", ar: "2 سماق" },
      { en: "2 toasted sesame", ar: "2 سمسم محمص" },
      { en: "½ salt", ar: "½ ملح" },
    ],
  },
  {
    emoji: "🫚",
    name: { en: "Seven spice (sabaa baharat)", ar: "السبع بهارات" },
    use: { en: "Kofta, kebab, rice dishes", ar: "الكفتة والكباب وأطباق الأرز" },
    parts: [
      { en: "2 black pepper", ar: "2 فلفل أسود" },
      { en: "2 allspice", ar: "2 بهار حلو" },
      { en: "1 cinnamon", ar: "1 قرفة" },
      { en: "1 cloves", ar: "1 قرنفل" },
      { en: "1 nutmeg", ar: "1 جوزة الطيب" },
      { en: "1 coriander", ar: "1 كزبرة" },
      { en: "1 ginger", ar: "1 زنجبيل" },
    ],
  },
  {
    emoji: "🍲",
    name: { en: "Ras el hanout (simple)", ar: "رأس الحانوت (مبسط)" },
    use: { en: "Tagines, couscous, roast chicken", ar: "الطواجن والكسكسي والدجاج المشوي" },
    parts: [
      { en: "2 cumin", ar: "2 كمون" },
      { en: "2 ginger", ar: "2 زنجبيل" },
      { en: "2 turmeric", ar: "2 كركم" },
      { en: "1 cinnamon", ar: "1 قرفة" },
      { en: "1 coriander", ar: "1 كزبرة" },
      { en: "1 paprika", ar: "1 بابريكا" },
      { en: "½ black pepper, ½ cardamom", ar: "½ فلفل أسود، ½ حبهان" },
    ],
  },
  {
    emoji: "🍛",
    name: { en: "Shawarma spice", ar: "بهارات الشاورما" },
    use: { en: "Chicken or beef shawarma marinade", ar: "تتبيلة شاورما الدجاج أو اللحم" },
    parts: [
      { en: "2 cumin", ar: "2 كمون" },
      { en: "2 paprika", ar: "2 بابريكا" },
      { en: "1 turmeric", ar: "1 كركم" },
      { en: "1 garlic powder", ar: "1 ثوم بودرة" },
      { en: "1 seven spice", ar: "1 سبع بهارات" },
      { en: "½ cardamom, ½ cinnamon", ar: "½ حبهان، ½ قرفة" },
    ],
  },
];
