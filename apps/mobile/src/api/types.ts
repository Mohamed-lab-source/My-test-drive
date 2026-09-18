export type DietGoal =
  | "NONE"
  | "FIT"
  | "INDULGENT"
  | "BALANCED"
  | "LOSE_WEIGHT"
  | "BUILD_MUSCLE"
  | "GAIN_WEIGHT";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type DishTag = "FIT" | "DESSERT" | "VEGETARIAN" | "QUICK" | "COMFORT" | "SPICY";
export type Allergen = "GLUTEN" | "DAIRY" | "EGGS" | "NUTS" | "PEANUTS" | "SHELLFISH" | "FISH" | "SOY" | "SESAME";

export type Preference = {
  id: string;
  dietGoal: DietGoal;
  favoriteCuisineSlugs: string[];
  allergies: Allergen[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  preference: Preference | null;
};

export type Cuisine = {
  id: string;
  slug: string;
  name: string;
  recipeCount: number;
};

export type RecipeSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  dishType: string;
  heroImageUrl: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  tags: DishTag[];
  avgRating: number | null;
  ratingCount: number;
  costPerServing: number;
  allergens: Allergen[];
  caloriesPerServing: number;
  proteinPerServing: number;
  cuisine: { slug: string; name: string };
};

export type RecipeIngredient = {
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
  substitute: string | null;
  allergens: Allergen[];
  /** Original ingredient name this was swapped from for a goal, e.g. "Flour" when name is "Oatmeal Flour". Null when not substituted. */
  substitutedFrom: string | null;
};

export type RecipeStep = {
  order: number;
  instruction: string;
  imageUrl: string;
  timerMinutes: number | null;
};

export type NutritionPerServing = {
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
};

export type RecipeDetail = RecipeSummary & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutritionPerServing: NutritionPerServing;
  myRating: number | null;
  adaptedForGoal: DietGoal | null;
};

export type RatingResult = {
  myScore: number;
  average: number;
  count: number;
};

export type ShoppingListItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
};

export type DeliveryPartner = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  logoEmoji: string;
};

export type ShoppingListResult = {
  id: string;
  recipe: { slug: string; title: string };
  servings: number;
  budget: number | null;
  totalEstimatedCost: number;
  withinBudget: boolean;
  budgetDifference: number | null;
  items: ShoppingListItem[];
  deliveryPartners: DeliveryPartner[];
};

export type NearbyStores = {
  mapsSearchUrl: string;
  deliveryPartners: DeliveryPartner[];
};

export type PantryIngredient = {
  id: string;
  name: string;
  category: string;
};

export type PantryMatch = RecipeSummary & {
  matchedIngredientCount: number;
  totalIngredientCount: number;
  missingIngredientNames: string[];
};
