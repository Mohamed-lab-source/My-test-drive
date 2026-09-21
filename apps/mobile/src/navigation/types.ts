import type { NavigatorScreenParams } from "@react-navigation/native";
import type { RecipeIngredient, RecipeStep } from "../api/types";

export type MainTabParamList = {
  Home: undefined;
  Lists: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  FeatureTour: { onFinishGoBack?: boolean } | undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  RecipeList: {
    cuisineSlug?: string;
    tag?: string;
    dishType?: string;
    title: string;
    sortByCost?: boolean;
    sortByRating?: boolean;
    lightOnly?: boolean;
  };
  RecipeDetail: { slug: string };
  ShoppingList: { slug: string; title: string; baseServings: number; initialServings?: number };
  CookMode: {
    slug: string;
    title: string;
    cuisineSlug: string;
    steps: RecipeStep[];
    ingredients: RecipeIngredient[];
    servings: number;
  };
  Login: undefined;
  Signup: undefined;
  Glossary: undefined;
  Notes: undefined;
  Search: undefined;
  MealPlanner: undefined;
  PantryFinder: undefined;
  CustomizeHome: undefined;
  CookingStats: undefined;
  LeanMuscleMode: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
