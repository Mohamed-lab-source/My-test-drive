export type GlossaryTerm = {
  id: string;
  emoji: string;
  term: { en: string; ar: string };
  description: { en: string; ar: string };
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "bloom-spices",
    emoji: "🌶️",
    term: { en: "Bloom spices", ar: "تحميص التوابل" },
    description: {
      en: "Frying dry spices briefly in hot oil or ghee before adding other ingredients. Heat unlocks flavor compounds that water alone can't release, so the spices taste far more fragrant than if just stirred in at the end.",
      ar: "قلي التوابل الجافة لفترة قصيرة في زيت أو سمن ساخن قبل إضافة المكونات الأخرى. الحرارة تُطلق مركبات النكهة التي لا يستطيع الماء وحده إطلاقها، فتصبح رائحة التوابل أقوى بكثير مما لو أُضيفت في النهاية فقط.",
    },
  },
  {
    id: "deglaze",
    emoji: "🍷",
    term: { en: "Deglaze", ar: "إذابة العالق" },
    description: {
      en: "Adding liquid (stock, wine, even water) to a hot pan after searing meat, then scraping up the browned bits stuck to the bottom. Those bits are packed with flavor and become the base of a sauce instead of going to waste.",
      ar: "إضافة سائل (مرقة، نبيذ، أو حتى ماء) إلى مقلاة ساخنة بعد تحمير اللحم، ثم كشط القطع البنية العالقة في القاع. هذه القطع مليئة بالنكهة وتصبح أساس الصلصة بدلاً من ضياعها.",
    },
  },
  {
    id: "fold",
    emoji: "🥄",
    term: { en: "Fold", ar: "الطي" },
    description: {
      en: "Gently combining a light, airy mixture (like whipped egg whites or cream) into a heavier one, using a scoop-and-turn motion instead of stirring. This keeps the air bubbles intact so cakes and mousses stay light.",
      ar: "دمج خليط خفيف ومنفوش (مثل بياض البيض المخفوق أو الكريمة) مع خليط أثقل، باستخدام حركة غرف وقلب بدلاً من التحريك. هذا يحافظ على فقاعات الهواء سليمة فتبقى الكيكات والموس خفيفة.",
    },
  },
  {
    id: "blanch",
    emoji: "🥦",
    term: { en: "Blanch", ar: "السلق السريع" },
    description: {
      en: "Briefly boiling vegetables, then plunging them into ice water to stop the cooking instantly. It sets bright color, softens texture just slightly, and is the first step before freezing or stir-frying many vegetables.",
      ar: "غلي الخضار لفترة قصيرة جداً، ثم غمسها فوراً في ماء مثلج لإيقاف الطهي على الفور. هذا يثبّت اللون الزاهي، ويُلين القوام قليلاً، وهو الخطوة الأولى قبل التجميد أو القلي السريع لكثير من الخضار.",
    },
  },
  {
    id: "sear",
    emoji: "🔥",
    term: { en: "Sear", ar: "التحمير" },
    description: {
      en: "Cooking the surface of meat or fish at very high heat until deeply browned, before finishing it more gently. The browning (Maillard reaction) creates hundreds of new flavor compounds you can't get any other way.",
      ar: "طهي سطح اللحم أو السمك على حرارة عالية جداً حتى يصبح بنياً غامقاً، قبل إتمام الطهي بحرارة أهدأ. هذا التحمير (تفاعل ميلارد) يُنتج مئات من مركبات النكهة الجديدة التي لا يمكن الحصول عليها بأي طريقة أخرى.",
    },
  },
  {
    id: "mise-en-place",
    emoji: "🥣",
    term: { en: "Mise en place", ar: "التجهيز المسبق" },
    description: {
      en: "French for 'everything in its place' — chopping, measuring, and organizing every ingredient before you start cooking. It turns a stressful recipe into a calm, quick sequence because nothing catches you off guard mid-step.",
      ar: "تعبير فرنسي يعني 'كل شيء في مكانه' — تقطيع وقياس وتنظيم كل مكون قبل البدء بالطهي. يحوّل الوصفة المرهقة إلى تسلسل هادئ وسريع لأن لا شيء يفاجئك أثناء الخطوات.",
    },
  },
  {
    id: "reduce",
    emoji: "♨️",
    term: { en: "Reduce", ar: "التركيز بالغليان" },
    description: {
      en: "Simmering a liquid uncovered so water evaporates, concentrating the flavor and thickening it naturally. A watery sauce becomes glossy and intense without adding any flour or cornstarch.",
      ar: "غلي السائل دون غطاء حتى يتبخر الماء منه، مما يركّز النكهة ويُثخّن السائل طبيعياً. الصلصة المائية تصبح لامعة وقوية النكهة دون إضافة أي دقيق أو نشا.",
    },
  },
  {
    id: "rest",
    emoji: "⏱️",
    term: { en: "Rest (meat)", ar: "إراحة اللحم" },
    description: {
      en: "Letting cooked meat sit for a few minutes before slicing. The juices, pushed to the center by heat, have time to redistribute — cut too soon and they spill onto the board instead of staying in the meat.",
      ar: "ترك اللحم المطهو يرتاح لبضع دقائق قبل تقطيعه. العصارة التي دفعتها الحرارة إلى المركز تحتاج وقتاً لإعادة التوزّع — إذا قطعته مبكراً فستنسكب على اللوح بدلاً من أن تبقى داخل اللحم.",
    },
  },
  {
    id: "marinate",
    emoji: "🧄",
    term: { en: "Marinate", ar: "التتبيل" },
    description: {
      en: "Soaking food, usually meat, in a flavored liquid (often with acid like lemon or yogurt) before cooking. It adds flavor throughout and, with acid or enzymes, can gently tenderize tougher cuts.",
      ar: "نقع الطعام، عادة اللحم، في سائل منكّه (غالباً يحتوي حمضاً مثل الليمون أو الزبادي) قبل الطهي. يضيف نكهة في العمق، ومع الحمض أو الإنزيمات يمكن أن يُطري القطع الأقسى بلطف.",
    },
  },
  {
    id: "emulsify",
    emoji: "🥣",
    term: { en: "Emulsify", ar: "الاستحلاب" },
    description: {
      en: "Forcing two liquids that normally separate — like oil and water — to blend into a smooth, stable mixture, usually by whisking in slowly. This is how mayonnaise and creamy vinaigrettes come together instead of splitting.",
      ar: "إجبار سائلين ينفصلان عادة — مثل الزيت والماء — على الامتزاج في خليط ناعم ومستقر، عادة بإضافة أحدهما تدريجياً أثناء الخفق. هكذا يتكوّن المايونيز والصلصات الكريمية بدلاً من أن ينفصل مكوناها.",
    },
  },
  {
    id: "caramelize",
    emoji: "🧅",
    term: { en: "Caramelize", ar: "الكرملة" },
    description: {
      en: "Cooking sugars (in onions, sugar itself, or other vegetables) slowly over gentle heat until they turn deep golden-brown and sweet. It takes patience — rushing with high heat burns the sugar instead of caramelizing it.",
      ar: "طهي السكريات (في البصل، أو السكر نفسه، أو خضار أخرى) ببطء على حرارة هادئة حتى تصبح بنية ذهبية غامقة وحلوة المذاق. يتطلب صبراً — الاستعجال بحرارة عالية يحرق السكر بدلاً من كرملته.",
    },
  },
  {
    id: "proof",
    emoji: "🍞",
    term: { en: "Proof (dough)", ar: "تخمير العجين" },
    description: {
      en: "Letting yeasted dough rest in a warm place so the yeast produces gas and the dough rises. Skipping or rushing this step gives dense, flat bread instead of a light, airy crumb.",
      ar: "ترك العجين المخمّر بالخميرة يرتاح في مكان دافئ حتى تُنتج الخميرة غازاً فيرتفع العجين. تخطي هذه الخطوة أو الاستعجال فيها يُعطي خبزاً كثيفاً ومسطحاً بدلاً من قوام خفيف ومنفوش.",
    },
  },
  {
    id: "temper",
    emoji: "🥚",
    term: { en: "Temper (eggs)", ar: "تدريج حرارة البيض" },
    description: {
      en: "Slowly whisking a small amount of hot liquid into beaten eggs before combining everything, to gradually raise the eggs' temperature. Skip this and the eggs scramble instead of thickening a sauce or custard smoothly.",
      ar: "خفق كمية صغيرة من السائل الساخن تدريجياً مع البيض المخفوق قبل دمج كل شيء، لرفع حرارة البيض تدريجياً. إذا تخطيت هذه الخطوة سيتجمد البيض بدلاً من أن يُثخّن الصلصة أو الكاسترد بسلاسة.",
    },
  },
  {
    id: "julienne",
    emoji: "🔪",
    term: { en: "Julienne", ar: "التقطيع الشرائحي الرفيع" },
    description: {
      en: "Cutting vegetables into thin, matchstick-sized strips of even size. Uniform pieces cook at the same rate, so nothing is mushy while other pieces are still raw.",
      ar: "تقطيع الخضار إلى شرائح رفيعة بحجم عود الثقاب ومتساوية الحجم. القطع المتساوية تُطهى بنفس المعدل، فلا يصبح جزء طرياً جداً بينما لا يزال جزء آخر نيئاً.",
    },
  },
  {
    id: "al-dente",
    emoji: "🍝",
    term: { en: "Al dente", ar: "درجة نضج متماسكة" },
    description: {
      en: "Italian for 'to the tooth' — cooking pasta or rice just until it offers slight resistance when bitten, not fully soft. It holds its shape better and keeps a more interesting texture in the finished dish.",
      ar: "تعبير إيطالي يعني 'على السن' — طهي المعكرونة أو الأرز حتى يبقى فيه مقاومة خفيفة عند العض، دون أن يصبح طرياً تماماً. يحافظ على شكله بشكل أفضل ويمنح قواماً أكثر تميزاً في الطبق النهائي.",
    },
  },
  {
    id: "baste",
    emoji: "🍗",
    term: { en: "Baste", ar: "الدهن أثناء الطهي" },
    description: {
      en: "Spooning or brushing hot fat or pan juices over food as it cooks, especially roasting meat. It adds flavor to the surface and helps keep it from drying out under prolonged heat.",
      ar: "سكب أو دهن الدهن الساخن أو عصارة المقلاة على الطعام أثناء طهيه، خاصة اللحم المشوي في الفرن. يضيف نكهة إلى السطح ويساعد على منعه من الجفاف تحت الحرارة الطويلة.",
    },
  },
];
