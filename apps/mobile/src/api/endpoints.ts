import { api } from "./client";
import type {
  Cuisine,
  DietGoal,
  NearbyStores,
  Preference,
  RecipeDetail,
  RecipeSummary,
  ShoppingListResult,
  User,
} from "./types";

export async function signup(email: string, password: string, name: string) {
  const { data } = await api.post<{ token: string; user: User }>("/auth/signup", {
    email,
    password,
    name,
  });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: User }>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function updatePreferences(patch: Partial<Preference> & { dietGoal?: DietGoal }) {
  const { data } = await api.put<Preference>("/auth/me/preferences", patch);
  return data;
}

export async function fetchCuisines() {
  const { data } = await api.get<Cuisine[]>("/cuisines");
  return data;
}

export async function fetchRecipes(params: { cuisine?: string; tag?: string; q?: string }) {
  const { data } = await api.get<RecipeSummary[]>("/recipes", { params });
  return data;
}

export async function fetchRecommended() {
  const { data } = await api.get<RecipeSummary[]>("/recipes/recommended");
  return data;
}

export async function fetchRecipeDetail(slug: string) {
  const { data } = await api.get<RecipeDetail>(`/recipes/${slug}`);
  return data;
}

export async function generateShoppingList(slug: string, servings: number, budget?: number) {
  const { data } = await api.post<ShoppingListResult>(`/recipes/${slug}/shopping-list`, {
    servings,
    budget,
  });
  return data;
}

export async function fetchShoppingListHistory() {
  const { data } = await api.get<
    { id: string; servings: number; totalEstimatedCost: number; withinBudget: boolean; createdAt: string; recipe: { slug: string; title: string; heroImageUrl: string } }[]
  >("/shopping-lists");
  return data;
}

export async function fetchNearbyStores(lat?: number, lng?: number) {
  const { data } = await api.get<NearbyStores>("/nearby-stores", { params: { lat, lng } });
  return data;
}
