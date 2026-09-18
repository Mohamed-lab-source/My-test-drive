import type { NavigatorScreenParams } from "@react-navigation/native";
import type { RecipeIngredient, RecipeStep } from "../api/types";

export type MainTabParamList = {
  Home: undefined;
  Lists: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  RecipeList: { cuisineSlug?: string; tag?: string; title: string };
  RecipeDetail: { slug: string };
  ShoppingList: { slug: string; title: string; baseServings: number; initialServings?: number };
  CookMode: {
    title: string;
    cuisineSlug: string;
    steps: RecipeStep[];
    ingredients: RecipeIngredient[];
    servings: number;
  };
  Login: undefined;
  Signup: undefined;
  Glossary: undefined;
  Search: undefined;
  MealPlanner: undefined;
  PantryFinder: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
