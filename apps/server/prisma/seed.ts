import { PrismaClient, DishTag, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

// Approximate Cairo/Egypt retail prices (EGP), normalized to a per-unit price
// so recipe costs can be estimated by quantity x pricePerUnit.
// unit "g" => EGP per gram, "ml" => EGP per millilitre, "pcs" => EGP per piece.
//
// `nutrition` is authored in familiar terms -- per 100g/100ml for "g"/"ml"
// ingredients, or per single item for "pcs" ingredients -- and converted to
// per-unit values (matching pricePerUnit's convention) at seed time. Figures
// are standard nutrition-database estimates, not lab-measured for these
// specific products.
type Nutrition = { kcal: number; protein: number; fat: number; carbs: number };

const ingredientMaster: {
  name: string;
  unit: "g" | "ml" | "pcs";
  pricePerUnit: number;
  category: string;
  nutrition: Nutrition;
}[] = [
  { name: "Flour", unit: "g", pricePerUnit: 0.03, category: "pantry", nutrition: { kcal: 364, protein: 10, fat: 1, carbs: 76 } },
  { name: "Yeast", unit: "g", pricePerUnit: 0.2, category: "pantry", nutrition: { kcal: 325, protein: 40, fat: 7, carbs: 41 } },
  { name: "Olive Oil", unit: "ml", pricePerUnit: 0.25, category: "pantry", nutrition: { kcal: 884, protein: 0, fat: 100, carbs: 0 } },
  { name: "Salt", unit: "g", pricePerUnit: 0.01, category: "pantry", nutrition: { kcal: 0, protein: 0, fat: 0, carbs: 0 } },
  { name: "Sugar", unit: "g", pricePerUnit: 0.03, category: "pantry", nutrition: { kcal: 387, protein: 0, fat: 0, carbs: 100 } },
  { name: "Tomato", unit: "g", pricePerUnit: 0.02, category: "produce", nutrition: { kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9 } },
  { name: "Mozzarella Cheese", unit: "g", pricePerUnit: 0.35, category: "dairy", nutrition: { kcal: 280, protein: 22, fat: 22, carbs: 2.2 } },
  { name: "Basil Leaves", unit: "g", pricePerUnit: 0.3, category: "produce", nutrition: { kcal: 23, protein: 3.2, fat: 0.6, carbs: 2.7 } },
  { name: "Spaghetti Pasta", unit: "g", pricePerUnit: 0.045, category: "pantry", nutrition: { kcal: 371, protein: 13, fat: 1.5, carbs: 75 } },
  { name: "Egg", unit: "pcs", pricePerUnit: 6, category: "dairy", nutrition: { kcal: 78, protein: 6.3, fat: 5.3, carbs: 0.6 } },
  { name: "Beef Bacon", unit: "g", pricePerUnit: 0.3, category: "meat", nutrition: { kcal: 300, protein: 20, fat: 24, carbs: 1 } },
  { name: "Parmesan Cheese", unit: "g", pricePerUnit: 0.5, category: "dairy", nutrition: { kcal: 431, protein: 38, fat: 29, carbs: 4.1 } },
  { name: "Black Pepper", unit: "g", pricePerUnit: 0.15, category: "pantry", nutrition: { kcal: 251, protein: 10, fat: 3.3, carbs: 64 } },
  { name: "Mascarpone Cheese", unit: "g", pricePerUnit: 0.4, category: "dairy", nutrition: { kcal: 429, protein: 4.8, fat: 44, carbs: 4.8 } },
  { name: "Ladyfinger Biscuits", unit: "pcs", pricePerUnit: 2, category: "pantry", nutrition: { kcal: 38, protein: 0.8, fat: 0.6, carbs: 7 } },
  { name: "Cocoa Powder", unit: "g", pricePerUnit: 0.2, category: "pantry", nutrition: { kcal: 228, protein: 20, fat: 14, carbs: 58 } },
  { name: "Brewed Coffee", unit: "ml", pricePerUnit: 0.1, category: "pantry", nutrition: { kcal: 1, protein: 0.1, fat: 0, carbs: 0 } },
  { name: "Rice", unit: "g", pricePerUnit: 0.035, category: "pantry", nutrition: { kcal: 365, protein: 7, fat: 0.7, carbs: 80 } },
  { name: "Chicken Breast", unit: "g", pricePerUnit: 0.18, category: "meat", nutrition: { kcal: 165, protein: 31, fat: 3.6, carbs: 0 } },
  { name: "Soy Sauce", unit: "ml", pricePerUnit: 0.06, category: "pantry", nutrition: { kcal: 53, protein: 8, fat: 0, carbs: 4.9 } },
  { name: "Spring Onion", unit: "g", pricePerUnit: 0.03, category: "produce", nutrition: { kcal: 32, protein: 1.8, fat: 0.2, carbs: 7.3 } },
  { name: "Carrot", unit: "g", pricePerUnit: 0.015, category: "produce", nutrition: { kcal: 41, protein: 0.9, fat: 0.2, carbs: 10 } },
  { name: "Garlic", unit: "g", pricePerUnit: 0.06, category: "produce", nutrition: { kcal: 149, protein: 6.4, fat: 0.5, carbs: 33 } },
  { name: "Rice Noodles", unit: "g", pricePerUnit: 0.06, category: "pantry", nutrition: { kcal: 364, protein: 6, fat: 0.6, carbs: 83 } },
  { name: "Shrimp", unit: "g", pricePerUnit: 0.3, category: "seafood", nutrition: { kcal: 99, protein: 24, fat: 0.3, carbs: 0.2 } },
  { name: "Peanuts", unit: "g", pricePerUnit: 0.12, category: "pantry", nutrition: { kcal: 567, protein: 26, fat: 49, carbs: 16 } },
  { name: "Lime", unit: "pcs", pricePerUnit: 5, category: "produce", nutrition: { kcal: 20, protein: 0.5, fat: 0.1, carbs: 7 } },
  { name: "Bean Sprouts", unit: "g", pricePerUnit: 0.025, category: "produce", nutrition: { kcal: 30, protein: 3, fat: 0.2, carbs: 6 } },
  { name: "Sticky Rice", unit: "g", pricePerUnit: 0.05, category: "pantry", nutrition: { kcal: 370, protein: 7.3, fat: 0.6, carbs: 81 } },
  { name: "Coconut Milk", unit: "ml", pricePerUnit: 0.09, category: "pantry", nutrition: { kcal: 230, protein: 2.3, fat: 24, carbs: 5.5 } },
  { name: "Mango", unit: "pcs", pricePerUnit: 25, category: "produce", nutrition: { kcal: 100, protein: 1.4, fat: 0.6, carbs: 25 } },
  { name: "Brown Lentils", unit: "g", pricePerUnit: 0.03, category: "pantry", nutrition: { kcal: 353, protein: 25, fat: 1.1, carbs: 60 } },
  { name: "Small Macaroni", unit: "g", pricePerUnit: 0.03, category: "pantry", nutrition: { kcal: 371, protein: 13, fat: 1.5, carbs: 75 } },
  { name: "Chickpeas", unit: "g", pricePerUnit: 0.04, category: "pantry", nutrition: { kcal: 164, protein: 8.9, fat: 2.6, carbs: 27 } },
  { name: "Onion", unit: "g", pricePerUnit: 0.015, category: "produce", nutrition: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3 } },
  { name: "Vinegar", unit: "ml", pricePerUnit: 0.02, category: "pantry", nutrition: { kcal: 18, protein: 0, fat: 0, carbs: 0.4 } },
  { name: "Cumin", unit: "g", pricePerUnit: 0.1, category: "pantry", nutrition: { kcal: 375, protein: 18, fat: 22, carbs: 44 } },
  { name: "Molokhia (chopped, frozen)", unit: "g", pricePerUnit: 0.06, category: "produce", nutrition: { kcal: 35, protein: 4.5, fat: 0.4, carbs: 5 } },
  { name: "Chicken Stock", unit: "ml", pricePerUnit: 0.02, category: "pantry", nutrition: { kcal: 4, protein: 0.6, fat: 0.1, carbs: 0.3 } },
  { name: "Coriander", unit: "g", pricePerUnit: 0.04, category: "produce", nutrition: { kcal: 216, protein: 23, fat: 13, carbs: 52 } },
  { name: "Semolina", unit: "g", pricePerUnit: 0.025, category: "pantry", nutrition: { kcal: 360, protein: 12.7, fat: 1, carbs: 73 } },
  { name: "Yogurt", unit: "g", pricePerUnit: 0.04, category: "dairy", nutrition: { kcal: 61, protein: 3.5, fat: 3.3, carbs: 4.7 } },
  { name: "Butter", unit: "g", pricePerUnit: 0.18, category: "dairy", nutrition: { kcal: 717, protein: 0.9, fat: 81, carbs: 0.1 } },
  { name: "Baking Powder", unit: "g", pricePerUnit: 0.08, category: "pantry", nutrition: { kcal: 53, protein: 0, fat: 0, carbs: 28 } },
  { name: "Shredded Coconut", unit: "g", pricePerUnit: 0.15, category: "pantry", nutrition: { kcal: 660, protein: 6.9, fat: 65, carbs: 24 } },
  { name: "Water", unit: "ml", pricePerUnit: 0, category: "pantry", nutrition: { kcal: 0, protein: 0, fat: 0, carbs: 0 } },
  { name: "Arborio Rice", unit: "g", pricePerUnit: 0.08, category: "pantry", nutrition: { kcal: 349, protein: 6.7, fat: 0.6, carbs: 77 } },
  { name: "Mushroom", unit: "g", pricePerUnit: 0.12, category: "produce", nutrition: { kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3 } },
  { name: "Vegetable Stock", unit: "ml", pricePerUnit: 0.02, category: "pantry", nutrition: { kcal: 3, protein: 0.3, fat: 0.1, carbs: 0.5 } },
  { name: "Crusty Bread", unit: "pcs", pricePerUnit: 15, category: "pantry", nutrition: { kcal: 662, protein: 22, fat: 8, carbs: 122 } },
  { name: "Cherry Tomato", unit: "g", pricePerUnit: 0.03, category: "produce", nutrition: { kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9 } },
  { name: "Heavy Cream", unit: "ml", pricePerUnit: 0.15, category: "dairy", nutrition: { kcal: 340, protein: 2.1, fat: 36, carbs: 2.8 } },
  { name: "Gelatin", unit: "g", pricePerUnit: 0.5, category: "pantry", nutrition: { kcal: 335, protein: 85, fat: 0.1, carbs: 0 } },
  { name: "Vanilla Extract", unit: "ml", pricePerUnit: 0.3, category: "pantry", nutrition: { kcal: 288, protein: 0.1, fat: 0.1, carbs: 13 } },
  { name: "Beef Brisket", unit: "g", pricePerUnit: 0.25, category: "meat", nutrition: { kcal: 291, protein: 18, fat: 24, carbs: 0 } },
  { name: "Star Anise", unit: "g", pricePerUnit: 0.3, category: "pantry", nutrition: { kcal: 337, protein: 18, fat: 16, carbs: 50 } },
  { name: "Cinnamon", unit: "g", pricePerUnit: 0.15, category: "pantry", nutrition: { kcal: 247, protein: 4, fat: 1.2, carbs: 81 } },
  { name: "Beef Sirloin", unit: "g", pricePerUnit: 0.28, category: "meat", nutrition: { kcal: 183, protein: 26, fat: 8, carbs: 0 } },
  { name: "Fish Sauce", unit: "ml", pricePerUnit: 0.08, category: "pantry", nutrition: { kcal: 35, protein: 5, fat: 0, carbs: 3.6 } },
  { name: "Sushi Rice", unit: "g", pricePerUnit: 0.06, category: "pantry", nutrition: { kcal: 370, protein: 6.5, fat: 0.5, carbs: 82 } },
  { name: "Rice Vinegar", unit: "ml", pricePerUnit: 0.1, category: "pantry", nutrition: { kcal: 20, protein: 0, fat: 0, carbs: 1 } },
  { name: "Nori Sheets", unit: "pcs", pricePerUnit: 3, category: "pantry", nutrition: { kcal: 10, protein: 1.2, fat: 0.1, carbs: 1.2 } },
  { name: "Cucumber", unit: "g", pricePerUnit: 0.02, category: "produce", nutrition: { kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6 } },
  { name: "Avocado", unit: "pcs", pricePerUnit: 15, category: "produce", nutrition: { kcal: 240, protein: 3, fat: 22, carbs: 12 } },
  { name: "Crab Stick", unit: "g", pricePerUnit: 0.15, category: "seafood", nutrition: { kcal: 95, protein: 9, fat: 0.5, carbs: 15 } },
  { name: "Green Curry Paste", unit: "g", pricePerUnit: 0.3, category: "pantry", nutrition: { kcal: 92, protein: 3, fat: 4, carbs: 12 } },
  { name: "Thai Basil", unit: "g", pricePerUnit: 0.3, category: "produce", nutrition: { kcal: 23, protein: 3.2, fat: 0.6, carbs: 2.7 } },
  { name: "Eggplant", unit: "g", pricePerUnit: 0.02, category: "produce", nutrition: { kcal: 25, protein: 1, fat: 0.2, carbs: 6 } },
  { name: "Fava Beans", unit: "g", pricePerUnit: 0.03, category: "pantry", nutrition: { kcal: 110, protein: 7.6, fat: 0.4, carbs: 19.7 } },
  { name: "Tahini", unit: "g", pricePerUnit: 0.15, category: "pantry", nutrition: { kcal: 595, protein: 17, fat: 54, carbs: 21 } },
  { name: "Lemon", unit: "pcs", pricePerUnit: 4, category: "produce", nutrition: { kcal: 17, protein: 0.6, fat: 0.2, carbs: 5.4 } },
  { name: "Ghee", unit: "g", pricePerUnit: 0.25, category: "dairy", nutrition: { kcal: 900, protein: 0, fat: 100, carbs: 0 } },
  { name: "Honey", unit: "g", pricePerUnit: 0.1, category: "pantry", nutrition: { kcal: 304, protein: 0.3, fat: 0, carbs: 82 } },
  { name: "Grape Leaves", unit: "g", pricePerUnit: 0.08, category: "produce", nutrition: { kcal: 33, protein: 2.4, fat: 0.8, carbs: 6 } },
  { name: "Ground Beef", unit: "g", pricePerUnit: 0.22, category: "meat", nutrition: { kcal: 254, protein: 17, fat: 20, carbs: 0 } },
  { name: "Dill", unit: "g", pricePerUnit: 0.05, category: "produce", nutrition: { kcal: 43, protein: 3.5, fat: 1.1, carbs: 7 } },
  { name: "Mint", unit: "g", pricePerUnit: 0.05, category: "produce", nutrition: { kcal: 44, protein: 3.3, fat: 0.7, carbs: 8 } },
];

const cuisines = [
  { slug: "italian", name: "Italian" },
  { slug: "asian", name: "Asian" },
  { slug: "egyptian", name: "Egyptian" },
];

// LoremFlickr returns real photos matching given keywords (unlike the previous
// purely-random picsum.photos placeholders). "lock" pins a stable photo per
// seed instead of a different random one on every fetch.
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100000;
}

const foodImg = (keywords: string, uniqueSeed: string, w = 900, h = 600) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?lock=${hashSeed(uniqueSeed)}`;

type RecipeSeed = {
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  dishType: string;
  // Keywords for sourcing a topically-relevant real food photo. Some dishes
  // (Egyptian ones especially) don't have great English tag coverage on
  // stock photo sites, so these fall back to the closest honest descriptor.
  imageKeywords: string;
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
    imageKeywords: "margherita,pizza",
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
    imageKeywords: "carbonara,pasta",
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
    imageKeywords: "tiramisu,dessert",
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
    imageKeywords: "friedrice,chicken",
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
    imageKeywords: "padthai,noodles",
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
    imageKeywords: "mango,stickyrice",
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
    imageKeywords: "rice,lentils",
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
    imageKeywords: "stew,greens",
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
    imageKeywords: "semolina,cake",
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
  {
    slug: "mushroom-risotto",
    title: "Mushroom Risotto",
    imageKeywords: "risotto,mushroom",
    description: "Creamy Arborio rice slowly simmered with mushrooms and Parmesan.",
    cuisine: "italian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 30,
    difficulty: Difficulty.MEDIUM,
    tags: [DishTag.VEGETARIAN, DishTag.COMFORT],
    ingredients: [
      { name: "Arborio Rice", quantity: 320, displayUnit: "g" },
      { name: "Mushroom", quantity: 300, displayUnit: "g" },
      { name: "Vegetable Stock", quantity: 1000, displayUnit: "ml" },
      { name: "Onion", quantity: 80, displayUnit: "g" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
      { name: "Parmesan Cheese", quantity: 80, displayUnit: "g" },
      { name: "Butter", quantity: 40, displayUnit: "g" },
      { name: "Olive Oil", quantity: 20, displayUnit: "ml" },
      { name: "Salt", quantity: 6, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Warm the vegetable stock in a pot and keep it at a low simmer." },
      { instruction: "Slice mushrooms and sauté in butter until golden, then set aside.", timerMinutes: 6 },
      { instruction: "In a wide pan, sauté onion and garlic in olive oil until soft.", timerMinutes: 4 },
      { instruction: "Add rice and toast for a minute, stirring, until the edges look translucent." },
      { instruction: "Add warm stock one ladle at a time, stirring often, waiting for each to absorb before adding more.", timerMinutes: 20 },
      { instruction: "Once the rice is creamy and just tender, stir in the mushrooms and Parmesan." },
      { instruction: "Season with salt, rest for a minute, then serve immediately." },
    ],
  },
  {
    slug: "bruschetta",
    title: "Bruschetta al Pomodoro",
    imageKeywords: "bruschetta,tomato",
    description: "Toasted bread rubbed with garlic and piled high with fresh tomato and basil.",
    cuisine: "italian",
    dishType: "Appetizer",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 5,
    difficulty: Difficulty.EASY,
    tags: [DishTag.QUICK, DishTag.VEGETARIAN],
    ingredients: [
      { name: "Crusty Bread", quantity: 1, displayUnit: "pcs", note: "1 small loaf, sliced" },
      { name: "Cherry Tomato", quantity: 400, displayUnit: "g" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
      { name: "Basil Leaves", quantity: 15, displayUnit: "g" },
      { name: "Olive Oil", quantity: 40, displayUnit: "ml" },
      { name: "Salt", quantity: 4, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Halve the cherry tomatoes and toss with torn basil, olive oil and salt." },
      { instruction: "Let the tomato mixture sit for 10 minutes so the flavors combine.", timerMinutes: 10 },
      { instruction: "Slice the bread and toast or grill until golden on both sides.", timerMinutes: 4 },
      { instruction: "Rub each warm slice with a cut clove of garlic." },
      { instruction: "Spoon the tomato mixture generously over each slice and serve immediately." },
    ],
  },
  {
    slug: "panna-cotta",
    title: "Panna Cotta",
    imageKeywords: "pannacotta,dessert",
    description: "Silky Italian set cream dessert, lightly sweetened and vanilla-scented.",
    cuisine: "italian",
    dishType: "Dessert",
    baseServings: 6,
    prepMinutes: 15,
    cookMinutes: 10,
    difficulty: Difficulty.EASY,
    tags: [DishTag.DESSERT],
    ingredients: [
      { name: "Heavy Cream", quantity: 600, displayUnit: "ml" },
      { name: "Sugar", quantity: 80, displayUnit: "g" },
      { name: "Gelatin", quantity: 10, displayUnit: "g" },
      { name: "Vanilla Extract", quantity: 10, displayUnit: "ml" },
      { name: "Water", quantity: 30, displayUnit: "ml", note: "to bloom the gelatin" },
    ],
    steps: [
      { instruction: "Sprinkle gelatin over the cold water and let it bloom for 5 minutes.", timerMinutes: 5 },
      { instruction: "Warm the cream, sugar and vanilla in a saucepan until just simmering, not boiling." },
      { instruction: "Remove from heat and whisk in the bloomed gelatin until fully dissolved." },
      { instruction: "Pour into serving cups or ramekins." },
      { instruction: "Refrigerate until fully set.", timerMinutes: 240 },
      { instruction: "Serve chilled, optionally with fresh berries or a fruit coulis." },
    ],
  },
  {
    slug: "beef-pho",
    title: "Beef Pho",
    imageKeywords: "pho,noodlesoup",
    description: "Vietnamese noodle soup with a fragrant star-anise beef broth.",
    cuisine: "asian",
    dishType: "Soup",
    baseServings: 4,
    prepMinutes: 20,
    cookMinutes: 90,
    difficulty: Difficulty.MEDIUM,
    tags: [DishTag.COMFORT],
    ingredients: [
      { name: "Beef Brisket", quantity: 500, displayUnit: "g" },
      { name: "Rice Noodles", quantity: 300, displayUnit: "g" },
      { name: "Beef Sirloin", quantity: 200, displayUnit: "g", note: "thinly sliced, added raw at serving" },
      { name: "Onion", quantity: 100, displayUnit: "g" },
      { name: "Star Anise", quantity: 6, displayUnit: "g" },
      { name: "Cinnamon", quantity: 4, displayUnit: "g" },
      { name: "Fish Sauce", quantity: 40, displayUnit: "ml" },
      { name: "Bean Sprouts", quantity: 100, displayUnit: "g" },
      { name: "Lime", quantity: 2, displayUnit: "pcs" },
      { name: "Coriander", quantity: 10, displayUnit: "g", note: "fresh, for garnish" },
      { name: "Salt", quantity: 6, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Char the onion under a broiler or over a flame until fragrant." },
      { instruction: "Simmer beef brisket with charred onion, star anise and cinnamon in water to make the broth.", timerMinutes: 75 },
      { instruction: "Remove the brisket, slice thinly, and strain the broth." },
      { instruction: "Season the broth with fish sauce and salt to taste." },
      { instruction: "Soak rice noodles in hot water until soft, then drain.", timerMinutes: 10 },
      { instruction: "Divide noodles into bowls, top with sliced brisket and raw beef sirloin slices." },
      { instruction: "Ladle the boiling hot broth over the bowl — it will cook the raw beef instantly." },
      { instruction: "Serve with bean sprouts, coriander and lime wedges on the side." },
    ],
  },
  {
    slug: "california-rolls",
    title: "California Rolls",
    imageKeywords: "sushi,californiaroll",
    description: "Approachable sushi rolls with crab stick, avocado and cucumber.",
    cuisine: "asian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 40,
    cookMinutes: 20,
    difficulty: Difficulty.HARD,
    tags: [DishTag.FIT],
    ingredients: [
      { name: "Sushi Rice", quantity: 400, displayUnit: "g" },
      { name: "Rice Vinegar", quantity: 60, displayUnit: "ml" },
      { name: "Sugar", quantity: 20, displayUnit: "g" },
      { name: "Nori Sheets", quantity: 4, displayUnit: "pcs" },
      { name: "Crab Stick", quantity: 200, displayUnit: "g" },
      { name: "Avocado", quantity: 1, displayUnit: "pcs" },
      { name: "Cucumber", quantity: 150, displayUnit: "g" },
      { name: "Salt", quantity: 3, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Cook the sushi rice, then fold in rice vinegar, sugar and salt while still warm.", timerMinutes: 20 },
      { instruction: "Let the seasoned rice cool to room temperature.", timerMinutes: 15 },
      { instruction: "Slice the avocado, cucumber and crab stick into thin strips." },
      { instruction: "Cover your bamboo mat with plastic wrap, then lay a nori sheet on top." },
      { instruction: "Spread rice in a thin, even layer over the whole sheet, right to every edge — this is what makes it a California roll (rice-out) rather than a standard nori-out maki roll." },
      { instruction: "Flip the nori over so the rice is face-down on the plastic wrap and the nori faces up." },
      { instruction: "Arrange crab stick, avocado and cucumber in a line across the center of the nori." },
      { instruction: "Using the mat and plastic wrap, roll it up tightly from the near edge, pressing gently so the rice ends up on the outside." },
      { instruction: "Slice each roll into 6-8 pieces with a sharp, wet knife, wiping the blade between cuts." },
    ],
  },
  {
    slug: "thai-green-curry",
    title: "Thai Green Curry",
    imageKeywords: "greencurry,thaifood",
    description: "Fragrant, spicy coconut curry with chicken, eggplant and Thai basil.",
    cuisine: "asian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    difficulty: Difficulty.MEDIUM,
    tags: [DishTag.SPICY],
    ingredients: [
      { name: "Chicken Breast", quantity: 500, displayUnit: "g" },
      { name: "Green Curry Paste", quantity: 80, displayUnit: "g" },
      { name: "Coconut Milk", quantity: 400, displayUnit: "ml" },
      { name: "Eggplant", quantity: 200, displayUnit: "g" },
      { name: "Thai Basil", quantity: 15, displayUnit: "g" },
      { name: "Fish Sauce", quantity: 25, displayUnit: "ml" },
      { name: "Sugar", quantity: 15, displayUnit: "g" },
      { name: "Rice", quantity: 300, displayUnit: "g", note: "steamed, to serve" },
    ],
    steps: [
      { instruction: "Slice chicken into bite-sized pieces and cube the eggplant." },
      { instruction: "Fry the green curry paste in a splash of coconut milk until fragrant.", timerMinutes: 3 },
      { instruction: "Add the chicken and cook until it starts to color.", timerMinutes: 5 },
      { instruction: "Pour in the remaining coconut milk and add the eggplant.", timerMinutes: 15 },
      { instruction: "Season with fish sauce and sugar to balance salty and sweet." },
      { instruction: "Stir in Thai basil leaves just before serving." },
      { instruction: "Serve hot over steamed rice." },
    ],
  },
  {
    slug: "ful-medames",
    title: "Ful Medames",
    imageKeywords: "fava,beans",
    description: "Classic Egyptian breakfast of stewed fava beans with olive oil, lemon and cumin.",
    cuisine: "egyptian",
    dishType: "Breakfast",
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: Difficulty.EASY,
    tags: [DishTag.VEGETARIAN, DishTag.FIT, DishTag.QUICK],
    ingredients: [
      { name: "Fava Beans", quantity: 400, displayUnit: "g", note: "canned or pre-cooked" },
      { name: "Tahini", quantity: 40, displayUnit: "g" },
      { name: "Lemon", quantity: 2, displayUnit: "pcs" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
      { name: "Cumin", quantity: 6, displayUnit: "g" },
      { name: "Olive Oil", quantity: 40, displayUnit: "ml" },
      { name: "Tomato", quantity: 150, displayUnit: "g", note: "diced, for topping" },
      { name: "Salt", quantity: 5, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Warm the fava beans in a pot with a splash of their liquid.", timerMinutes: 10 },
      { instruction: "Mash lightly with a fork, leaving some texture." },
      { instruction: "Stir in mashed garlic, cumin and salt." },
      { instruction: "Mix tahini with lemon juice and a little water until smooth, then stir into the beans." },
      { instruction: "Spoon into a serving dish and drizzle generously with olive oil." },
      { instruction: "Top with diced tomato and serve warm with bread." },
    ],
  },
  {
    slug: "mahshi-warak-enab",
    title: "Stuffed Grape Leaves (Mahshi)",
    imageKeywords: "dolma,grapeleaves",
    description: "Grape leaves rolled around a herbed rice and beef filling, gently simmered.",
    cuisine: "egyptian",
    dishType: "Main Course",
    baseServings: 4,
    prepMinutes: 45,
    cookMinutes: 40,
    difficulty: Difficulty.HARD,
    tags: [DishTag.COMFORT],
    ingredients: [
      { name: "Grape Leaves", quantity: 300, displayUnit: "g" },
      { name: "Rice", quantity: 250, displayUnit: "g" },
      { name: "Ground Beef", quantity: 200, displayUnit: "g" },
      { name: "Tomato", quantity: 150, displayUnit: "g", note: "finely diced" },
      { name: "Dill", quantity: 10, displayUnit: "g" },
      { name: "Mint", quantity: 10, displayUnit: "g" },
      { name: "Garlic", quantity: 10, displayUnit: "g" },
      { name: "Lemon", quantity: 2, displayUnit: "pcs" },
      { name: "Olive Oil", quantity: 40, displayUnit: "ml" },
      { name: "Salt", quantity: 6, displayUnit: "g" },
    ],
    steps: [
      { instruction: "Rinse the grape leaves and blanch briefly if using jarred leaves.", timerMinutes: 3 },
      { instruction: "Mix rice, ground beef, diced tomato, dill, mint, garlic and salt for the filling." },
      { instruction: "Lay a leaf flat, place a spoonful of filling near the stem, and roll tightly into a small cylinder." },
      { instruction: "Repeat with the remaining leaves, packing the rolls snugly in a pot." },
      { instruction: "Drizzle with olive oil and lemon juice, then add water to just cover the rolls." },
      { instruction: "Place a small plate on top to weigh the rolls down and simmer gently.", timerMinutes: 40 },
      { instruction: "Let rest for a few minutes before serving warm with extra lemon wedges." },
    ],
  },
  {
    slug: "feteer-meshaltet",
    title: "Feteer Meshaltet",
    imageKeywords: "flakypastry,layeredbread",
    description: "Flaky, layered Egyptian pastry, served plain with honey or filled sweet.",
    cuisine: "egyptian",
    dishType: "Dessert",
    baseServings: 6,
    prepMinutes: 60,
    cookMinutes: 20,
    difficulty: Difficulty.HARD,
    tags: [DishTag.DESSERT],
    ingredients: [
      { name: "Flour", quantity: 500, displayUnit: "g" },
      { name: "Ghee", quantity: 150, displayUnit: "g" },
      { name: "Sugar", quantity: 20, displayUnit: "g" },
      { name: "Salt", quantity: 5, displayUnit: "g" },
      { name: "Water", quantity: 250, displayUnit: "ml" },
      { name: "Honey", quantity: 100, displayUnit: "g", note: "for serving" },
    ],
    steps: [
      { instruction: "Mix flour, sugar, salt and water into a soft, elastic dough.", timerMinutes: 10 },
      { instruction: "Divide into balls, coat generously in ghee, and rest covered.", timerMinutes: 30 },
      { instruction: "Stretch each ball by hand into a very thin, almost see-through sheet." },
      { instruction: "Fold and layer the stretched sheet into a coil, then flatten into a round." },
      { instruction: "Rest the shaped dough briefly before baking.", timerMinutes: 10 },
      { instruction: "Bake in a very hot oven until golden and flaky, puffing up in layers.", timerMinutes: 15 },
      { instruction: "Drizzle warm with honey before serving." },
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
    // "pcs" nutrition is already per-item; "g"/"ml" is authored per 100 units.
    const divisor = ing.unit === "pcs" ? 1 : 100;
    const perUnit = {
      caloriesPerUnit: ing.nutrition.kcal / divisor,
      proteinPerUnit: ing.nutrition.protein / divisor,
      fatPerUnit: ing.nutrition.fat / divisor,
      carbsPerUnit: ing.nutrition.carbs / divisor,
    };
    const row = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: { unit: ing.unit, pricePerUnit: ing.pricePerUnit, category: ing.category, ...perUnit },
      create: {
        name: ing.name,
        unit: ing.unit,
        pricePerUnit: ing.pricePerUnit,
        category: ing.category,
        ...perUnit,
      },
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
        heroImageUrl: foodImg(r.imageKeywords, r.slug),
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
        heroImageUrl: foodImg(r.imageKeywords, r.slug),
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
          imageUrl: foodImg(r.imageKeywords, `${r.slug}-step-${i + 1}`),
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
