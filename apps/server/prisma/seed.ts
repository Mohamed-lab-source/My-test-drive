import { PrismaClient, DishTag, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

// Approximate Cairo/Egypt retail prices (EGP), normalized to a per-unit price
// so recipe costs can be estimated by quantity x pricePerUnit.
// unit "g" => EGP per gram, "ml" => EGP per millilitre, "pcs" => EGP per piece.
const ingredientMaster: {
  name: string;
  unit: "g" | "ml" | "pcs";
  pricePerUnit: number;
  category: string;
}[] = [
  { name: "Flour", unit: "g", pricePerUnit: 0.03, category: "pantry" },
  { name: "Yeast", unit: "g", pricePerUnit: 0.2, category: "pantry" },
  { name: "Olive Oil", unit: "ml", pricePerUnit: 0.25, category: "pantry" },
  { name: "Salt", unit: "g", pricePerUnit: 0.01, category: "pantry" },
  { name: "Sugar", unit: "g", pricePerUnit: 0.03, category: "pantry" },
  { name: "Tomato", unit: "g", pricePerUnit: 0.02, category: "produce" },
  { name: "Mozzarella Cheese", unit: "g", pricePerUnit: 0.35, category: "dairy" },
  { name: "Basil Leaves", unit: "g", pricePerUnit: 0.3, category: "produce" },
  { name: "Spaghetti Pasta", unit: "g", pricePerUnit: 0.045, category: "pantry" },
  { name: "Egg", unit: "pcs", pricePerUnit: 6, category: "dairy" },
  { name: "Beef Bacon", unit: "g", pricePerUnit: 0.3, category: "meat" },
  { name: "Parmesan Cheese", unit: "g", pricePerUnit: 0.5, category: "dairy" },
  { name: "Black Pepper", unit: "g", pricePerUnit: 0.15, category: "pantry" },
  { name: "Mascarpone Cheese", unit: "g", pricePerUnit: 0.4, category: "dairy" },
  { name: "Ladyfinger Biscuits", unit: "pcs", pricePerUnit: 2, category: "pantry" },
  { name: "Cocoa Powder", unit: "g", pricePerUnit: 0.2, category: "pantry" },
  { name: "Brewed Coffee", unit: "ml", pricePerUnit: 0.1, category: "pantry" },
  { name: "Rice", unit: "g", pricePerUnit: 0.035, category: "pantry" },
  { name: "Chicken Breast", unit: "g", pricePerUnit: 0.18, category: "meat" },
  { name: "Soy Sauce", unit: "ml", pricePerUnit: 0.06, category: "pantry" },
  { name: "Spring Onion", unit: "g", pricePerUnit: 0.03, category: "produce" },
  { name: "Carrot", unit: "g", pricePerUnit: 0.015, category: "produce" },
  { name: "Garlic", unit: "g", pricePerUnit: 0.06, category: "produce" },
  { name: "Rice Noodles", unit: "g", pricePerUnit: 0.06, category: "pantry" },
  { name: "Shrimp", unit: "g", pricePerUnit: 0.3, category: "seafood" },
  { name: "Peanuts", unit: "g", pricePerUnit: 0.12, category: "pantry" },
  { name: "Lime", unit: "pcs", pricePerUnit: 5, category: "produce" },
  { name: "Bean Sprouts", unit: "g", pricePerUnit: 0.025, category: "produce" },
  { name: "Sticky Rice", unit: "g", pricePerUnit: 0.05, category: "pantry" },
  { name: "Coconut Milk", unit: "ml", pricePerUnit: 0.09, category: "pantry" },
  { name: "Mango", unit: "pcs", pricePerUnit: 25, category: "produce" },
  { name: "Brown Lentils", unit: "g", pricePerUnit: 0.03, category: "pantry" },
  { name: "Small Macaroni", unit: "g", pricePerUnit: 0.03, category: "pantry" },
  { name: "Chickpeas", unit: "g", pricePerUnit: 0.04, category: "pantry" },
  { name: "Onion", unit: "g", pricePerUnit: 0.015, category: "produce" },
  { name: "Vinegar", unit: "ml", pricePerUnit: 0.02, category: "pantry" },
  { name: "Cumin", unit: "g", pricePerUnit: 0.1, category: "pantry" },
  { name: "Molokhia (chopped, frozen)", unit: "g", pricePerUnit: 0.06, category: "produce" },
  { name: "Chicken Stock", unit: "ml", pricePerUnit: 0.02, category: "pantry" },
  { name: "Coriander", unit: "g", pricePerUnit: 0.04, category: "produce" },
  { name: "Semolina", unit: "g", pricePerUnit: 0.025, category: "pantry" },
  { name: "Yogurt", unit: "g", pricePerUnit: 0.04, category: "dairy" },
  { name: "Butter", unit: "g", pricePerUnit: 0.18, category: "dairy" },
  { name: "Baking Powder", unit: "g", pricePerUnit: 0.08, category: "pantry" },
  { name: "Shredded Coconut", unit: "g", pricePerUnit: 0.15, category: "pantry" },
  { name: "Water", unit: "ml", pricePerUnit: 0, category: "pantry" },
];

const cuisines = [
  { slug: "italian", name: "Italian" },
  { slug: "asian", name: "Asian" },
  { slug: "egyptian", name: "Egyptian" },
];

const img = (seed: string, w = 900, h = 600) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

type RecipeSeed = {
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  dishType: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  tags: DishTag[];
  ingredients: { name: string; quantity: number; displayUnit: string; note?: string }[];
  steps: { instruction: string; timerMinutes?: number }[];
};

const recipes: RecipeSeed[] = [
  {
    slug: "margherita-pizza",
    title: "Margherita Pizza",
    description: "Classic Neapolitan-style pizza with tomato, fresh mozzarella and basil.",
    cuisine: "italian",
    dishType: "Pizza",
    baseServings: 4,
    prepMinutes: 90,
    cookMinutes: 15,
    difficulty: Difficulty.MEDIUM,
    tags: [],
    ingredients: [
      { name: "Flour", quantity: 500, displayUnit: "g" },
      { name: "Yeast", quantity: 7, displayUnit: "g" },
      { name: "Olive Oil", quantity: 30, displayUnit: "ml" },
      { name: "Salt", quantity: 10, displayUnit: "g" },
      { name: "Tomato", quantity: 300, displayUnit: "g", note: "crushed / passata" },
      { name: "Mozzarella Cheese", quantity: 300, displayUnit: "g" },
      { name: "Basil Leaves", quantity: 10, displayUnit: "g" },
      { name: "Water", quantity: 320, displayUnit: "ml" },
    ],
    steps: [
      { instruction: "Dissolve yeast in warm water and let sit for 5 minutes until foamy.", timerMinutes: 5 },
      { instruction: "Mix flour and salt, add the yeast water and olive oil, knead into a smooth dough." , timerMinutes: 10},
      { instruction: "Cover and let the dough rise in a warm place until doubled in size.", timerMinutes: 60 },
      { instruction: "Preheat oven to its highest setting with a pizza stone or tray inside." },
      { instruction: "Divide dough into 4 balls, stretch each into a thin round on a floured surface." },
      { instruction: "Spread crushed tomato over the base, leaving a border for the crust." },
      { instruction: "Tear mozzarella over the top and drizzle with olive oil." },
      { instruction: "Bake until the crust is puffed and golden with charred spots.", timerMinutes: 8 },
      { instruction: "Scatter fresh basil leaves on top and slice while hot." },
    ],
  },
  {
    slug: "spaghetti-carbonara",
    title: "Spaghetti Carbonara",
    description: "Creamy Roman pasta made with egg, cheese, cured pork and black pepper — no cream needed.",
    cuisine: "italian",
    dishType: "Pasta",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: Difficulty.EASY,
    tags: [DishTag.QUICK],
    ingredients: [
      { name: "Spaghetti Pasta", quantity: 400, displayUnit: "g" },
      { name: "Beef Bacon", quantity: 150, displayUnit: "g", note: "pork-free substitute for guanciale" },
      { name: "Egg", quantity: 4, displayUnit: "pcs" },
      { name: "Parmesan Cheese", quantity: 100, displayUnit: "g" },
      { name: "Black Pepper", quantity: 3, displayUnit: "g" },
      { name: "Salt", quantity: 5, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Bring a large pot of salted water to a boil and cook spaghetti until al dente.", timerMinutes: 10 },
      { instruction: "While pasta cooks, fry beef bacon in a pan until crisp.", timerMinutes: 6 },
      { instruction: "Whisk eggs with grated Parmesan and a generous amount of black pepper in a bowl." },
      { instruction: "Reserve a cup of pasta water, then drain the spaghetti." },
      { instruction: "Off the heat, toss hot pasta with the bacon, then quickly stir in the egg mixture." },
      { instruction: "Add splashes of pasta water until glossy and creamy — do not let it scramble." },
      { instruction: "Serve immediately with extra Parmesan and black pepper on top." },
    ],
  },
  {
    slug: "tiramisu",
    title: "Tiramisu",
    description: "No-bake Italian dessert layered with coffee-soaked ladyfingers and mascarpone cream.",
    cuisine: "italian",
    dishType: "Dessert",
    baseServings: 8,
    prepMinutes: 30,
    cookMinutes: 0,
    difficulty: Difficulty.EASY,
    tags: [DishTag.DESSERT],
    ingredients: [
      { name: "Ladyfinger Biscuits", quantity: 24, displayUnit: "pcs" },
      { name: "Brewed Coffee", quantity: 300, displayUnit: "ml" },
      { name: "Mascarpone Cheese", quantity: 500, displayUnit: "g" },
      { name: "Egg", quantity: 4, displayUnit: "pcs" },
      { name: "Sugar", quantity: 100, displayUnit: "g" },
      { name: "Cocoa Powder", quantity: 15, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Brew coffee and let it cool to room temperature." },
      { instruction: "Separate eggs; whisk yolks with sugar until pale and thick." },
      { instruction: "Fold mascarpone into the yolk mixture until smooth." },
      { instruction: "Whisk egg whites to stiff peaks, then gently fold into the mascarpone mixture." },
      { instruction: "Dip each ladyfinger briefly in coffee and layer in a dish." },
      { instruction: "Spread half the mascarpone cream over the biscuits, then repeat with another layer." },
      { instruction: "Dust the top generously with cocoa powder." },
      { instruction: "Refrigerate for at least 4 hours before serving.", timerMinutes: 240 },
    ],
  },
  {
    slug: "chicken-fried-rice",
    title: "Chicken Fried Rice",
    description: "Quick wok-fried rice with chicken, egg and vegetables in savory soy sauce.",
    cuisine: "asian",
    dishType: "Rice",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 15,
    difficulty: Difficulty.EASY,
    tags: [DishTag.QUICK, DishTag.FIT],
    ingredients: [
      { name: "Rice", quantity: 600, displayUnit: "g", note: "cooked and cooled, day-old is best" },
      { name: "Chicken Breast", quantity: 300, displayUnit: "g" },
      { name: "Egg", quantity: 2, displayUnit: "pcs" },
      { name: "Soy Sauce", quantity: 45, displayUnit: "ml" },
      { name: "Spring Onion", quantity: 30, displayUnit: "g" },
      { name: "Carrot", quantity: 80, displayUnit: "g" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
      { name: "Olive Oil", quantity: 20, displayUnit: "ml" },
    ],
    steps: [
      { instruction: "Cut chicken into small cubes and dice the carrot finely." },
      { instruction: "Heat oil in a wok over high heat and stir-fry chicken until cooked through.", timerMinutes: 6 },
      { instruction: "Push chicken aside, add garlic and carrot, stir-fry until fragrant.", timerMinutes: 2 },
      { instruction: "Push everything aside, crack in eggs and scramble until just set." },
      { instruction: "Add the cold rice, breaking up clumps, and toss everything together.", timerMinutes: 4 },
      { instruction: "Pour in soy sauce and toss until evenly coated." },
      { instruction: "Stir in spring onion and serve hot." },
    ],
  },
  {
    slug: "pad-thai",
    title: "Pad Thai",
    description: "Stir-fried rice noodles with shrimp, egg, peanuts and a tangy-sweet sauce.",
    cuisine: "asian",
    dishType: "Noodles",
    baseServings: 4,
    prepMinutes: 20,
    cookMinutes: 15,
    difficulty: Difficulty.MEDIUM,
    tags: [],
    ingredients: [
      { name: "Rice Noodles", quantity: 300, displayUnit: "g" },
      { name: "Shrimp", quantity: 250, displayUnit: "g" },
      { name: "Egg", quantity: 2, displayUnit: "pcs" },
      { name: "Bean Sprouts", quantity: 150, displayUnit: "g" },
      { name: "Peanuts", quantity: 60, displayUnit: "g" },
      { name: "Lime", quantity: 2, displayUnit: "pcs" },
      { name: "Soy Sauce", quantity: 40, displayUnit: "ml" },
      { name: "Sugar", quantity: 30, displayUnit: "g" },
      { name: "Spring Onion", quantity: 20, displayUnit: "g" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Soak rice noodles in warm water until pliable, then drain.", timerMinutes: 20 },
      { instruction: "Mix soy sauce, sugar and juice of one lime into a sauce." },
      { instruction: "Heat a wok and stir-fry garlic and shrimp until shrimp turns pink.", timerMinutes: 4 },
      { instruction: "Push aside, scramble in the eggs until just set." },
      { instruction: "Add drained noodles and the sauce, tossing until noodles are coated.", timerMinutes: 4 },
      { instruction: "Add bean sprouts and half the peanuts, toss briefly." },
      { instruction: "Plate and top with remaining peanuts, spring onion and a lime wedge." },
    ],
  },
  {
    slug: "mango-sticky-rice",
    title: "Mango Sticky Rice",
    description: "Thai dessert of sweet coconut sticky rice served with ripe mango.",
    cuisine: "asian",
    dishType: "Dessert",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    difficulty: Difficulty.EASY,
    tags: [DishTag.DESSERT],
    ingredients: [
      { name: "Sticky Rice", quantity: 300, displayUnit: "g" },
      { name: "Coconut Milk", quantity: 300, displayUnit: "ml" },
      { name: "Sugar", quantity: 60, displayUnit: "g" },
      { name: "Salt", quantity: 2, displayUnit: "g" },
      { name: "Mango", quantity: 2, displayUnit: "pcs" },
    ],
    steps: [
      { instruction: "Soak sticky rice in water for at least 2 hours, then drain.", timerMinutes: 120 },
      { instruction: "Steam the rice over boiling water until tender.", timerMinutes: 25 },
      { instruction: "Warm coconut milk with sugar and salt until dissolved, reserving some for topping." },
      { instruction: "Pour most of the coconut mixture over the hot rice and let it absorb.", timerMinutes: 15 },
      { instruction: "Peel and slice the mango." },
      { instruction: "Serve rice with mango slices and drizzle with the reserved coconut sauce." },
    ],
  },
  {
    slug: "koshari",
    title: "Koshari",
    description: "Egypt's beloved street food: rice, lentils and pasta topped with spiced tomato sauce, chickpeas and crispy onions.",
    cuisine: "egyptian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 20,
    cookMinutes: 40,
    difficulty: Difficulty.MEDIUM,
    tags: [DishTag.VEGETARIAN, DishTag.FIT],
    ingredients: [
      { name: "Rice", quantity: 300, displayUnit: "g" },
      { name: "Brown Lentils", quantity: 200, displayUnit: "g" },
      { name: "Small Macaroni", quantity: 200, displayUnit: "g" },
      { name: "Chickpeas", quantity: 200, displayUnit: "g" },
      { name: "Tomato", quantity: 400, displayUnit: "g" },
      { name: "Onion", quantity: 250, displayUnit: "g", note: "half fried crispy, half for sauce" },
      { name: "Garlic", quantity: 15, displayUnit: "g" },
      { name: "Vinegar", quantity: 20, displayUnit: "ml" },
      { name: "Cumin", quantity: 5, displayUnit: "g" },
      { name: "Olive Oil", quantity: 60, displayUnit: "ml" },
      { name: "Salt", quantity: 8, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Cook rice, lentils, macaroni and chickpeas separately until each is tender.", timerMinutes: 25 },
      { instruction: "Thinly slice onions and fry in oil until deep golden and crispy, then set aside." },
      { instruction: "In the same pan, sauté garlic, then add tomato, cumin and salt to make the sauce.", timerMinutes: 15 },
      { instruction: "Stir vinegar into a small portion of the tomato sauce for a tangy dakka sauce." },
      { instruction: "Layer rice, lentils and macaroni in a bowl." },
      { instruction: "Top with chickpeas, tomato sauce and crispy onions." },
      { instruction: "Drizzle with the vinegar-spiked sauce to taste and serve." },
    ],
  },
  {
    slug: "molokhia-with-chicken",
    title: "Molokhia with Chicken",
    description: "Comforting Egyptian green stew made from jute leaves in garlicky broth, served with chicken and rice.",
    cuisine: "egyptian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 35,
    difficulty: Difficulty.MEDIUM,
    tags: [DishTag.COMFORT],
    ingredients: [
      { name: "Molokhia (chopped, frozen)", quantity: 500, displayUnit: "g" },
      { name: "Chicken Breast", quantity: 500, displayUnit: "g" },
      { name: "Chicken Stock", quantity: 800, displayUnit: "ml" },
      { name: "Garlic", quantity: 20, displayUnit: "g" },
      { name: "Coriander", quantity: 10, displayUnit: "g", note: "dried, ground" },
      { name: "Olive Oil", quantity: 30, displayUnit: "ml" },
      { name: "Rice", quantity: 250, displayUnit: "g" },
      { name: "Salt", quantity: 8, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Poach the chicken in the stock until fully cooked, then shred or slice it, reserving the broth.", timerMinutes: 25 },
      { instruction: "Cook rice separately as a side." },
      { instruction: "Bring the reserved chicken broth to a simmer and add the molokhia leaves.", timerMinutes: 10 },
      { instruction: "Finely mince garlic and fry in olive oil with ground coriander until fragrant (takhta)." },
      { instruction: "Stir the garlic-coriander mixture into the simmering molokhia." },
      { instruction: "Season with salt and simmer a few more minutes.", timerMinutes: 5 },
      { instruction: "Serve the molokhia over rice with the chicken on the side." },
    ],
  },
  {
    slug: "basbousa",
    title: "Basbousa",
    description: "Sweet Egyptian semolina cake soaked in syrup, a beloved teatime dessert.",
    cuisine: "egyptian",
    dishType: "Dessert",
    baseServings: 8,
    prepMinutes: 15,
    cookMinutes: 30,
    difficulty: Difficulty.EASY,
    tags: [DishTag.DESSERT],
    ingredients: [
      { name: "Semolina", quantity: 400, displayUnit: "g" },
      { name: "Sugar", quantity: 300, displayUnit: "g", note: "half for batter, half for syrup" },
      { name: "Yogurt", quantity: 200, displayUnit: "g" },
      { name: "Butter", quantity: 100, displayUnit: "g", note: "melted" },
      { name: "Baking Powder", quantity: 10, displayUnit: "g" },
      { name: "Shredded Coconut", quantity: 50, displayUnit: "g" },
      { name: "Water", quantity: 200, displayUnit: "ml", note: "for syrup" },
    ],
    steps: [
      { instruction: "Preheat oven to 180°C (350°F)." },
      { instruction: "Mix semolina, half the sugar, yogurt, melted butter, baking powder and coconut into a batter." },
      { instruction: "Pour batter into a greased tray and smooth the top." },
      { instruction: "Score the batter into diamond shapes before baking." },
      { instruction: "Bake until golden on top.", timerMinutes: 30 },
      { instruction: "Meanwhile, boil water with remaining sugar until syrupy, then cool slightly.", timerMinutes: 10 },
      { instruction: "Pour the warm syrup evenly over the hot cake and let it soak in.", timerMinutes: 15 },
      { instruction: "Serve at room temperature, cut along the scored lines." },
    ],
  },
];

const deliveryPartners = [
  { slug: "talabat", name: "Talabat", websiteUrl: "https://www.talabat.com", logoEmoji: "🛵" },
  { slug: "breadfast", name: "Breadfast", websiteUrl: "https://www.breadfast.com", logoEmoji: "🥐" },
  { slug: "instashop", name: "InstaShop", websiteUrl: "https://www.instashop.com", logoEmoji: "🛒" },
];

async function main() {
  console.log("Seeding ingredients...");
  const ingredientBySlug = new Map<string, string>();
  for (const ing of ingredientMaster) {
    const row = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: { unit: ing.unit, pricePerUnit: ing.pricePerUnit, category: ing.category },
      create: ing,
    });
    ingredientBySlug.set(ing.name, row.id);
  }

  console.log("Seeding cuisines...");
  const cuisineBySlug = new Map<string, string>();
  for (const c of cuisines) {
    const row = await prisma.cuisine.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    cuisineBySlug.set(c.slug, row.id);
  }

  console.log("Seeding delivery partners...");
  for (const dp of deliveryPartners) {
    await prisma.deliveryPartner.upsert({
      where: { slug: dp.slug },
      update: dp,
      create: dp,
    });
  }

  console.log("Seeding recipes...");
  for (const r of recipes) {
    const cuisineId = cuisineBySlug.get(r.cuisine);
    if (!cuisineId) throw new Error(`Unknown cuisine ${r.cuisine}`);

    // Clean slate for idempotent re-seeding: delete existing recipe + children first.
    const existing = await prisma.recipe.findUnique({ where: { slug: r.slug } });
    if (existing) {
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
      await prisma.recipeStep.deleteMany({ where: { recipeId: existing.id } });
    }

    const recipe = await prisma.recipe.upsert({
      where: { slug: r.slug },
      update: {
        title: r.title,
        description: r.description,
        cuisineId,
        dishType: r.dishType,
        heroImageUrl: img(r.slug),
        baseServings: r.baseServings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        difficulty: r.difficulty,
        tags: r.tags,
      },
      create: {
        slug: r.slug,
        title: r.title,
        description: r.description,
        cuisineId,
        dishType: r.dishType,
        heroImageUrl: img(r.slug),
        baseServings: r.baseServings,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        difficulty: r.difficulty,
        tags: r.tags,
      },
    });

    for (const ri of r.ingredients) {
      const ingredientId = ingredientBySlug.get(ri.name);
      if (!ingredientId) throw new Error(`Unknown ingredient ${ri.name} for recipe ${r.slug}`);
      await prisma.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          ingredientId,
          quantity: ri.quantity,
          displayUnit: ri.displayUnit,
          note: ri.note,
        },
      });
    }

    for (let i = 0; i < r.steps.length; i++) {
      const step = r.steps[i];
      await prisma.recipeStep.create({
        data: {
          recipeId: recipe.id,
          order: i + 1,
          instruction: step.instruction,
          imageUrl: img(`${r.slug}-step-${i + 1}`),
          timerMinutes: step.timerMinutes,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
