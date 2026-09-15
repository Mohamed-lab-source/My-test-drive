import type { NavigatorScreenParams } from "@react-navigation/native";

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
  ShoppingList: { slug: string; title: string; baseServings: number };
  Login: undefined;
  Signup: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
