import React from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { FeatureTourScreen } from "../screens/FeatureTourScreen";
import { RecipeListScreen } from "../screens/RecipeListScreen";
import { RecipeDetailScreen } from "../screens/RecipeDetailScreen";
import { ShoppingListScreen } from "../screens/ShoppingListScreen";
import { CookModeScreen } from "../screens/CookModeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { SignupScreen } from "../screens/SignupScreen";
import { GlossaryScreen } from "../screens/GlossaryScreen";
import { NotesListScreen } from "../screens/NotesListScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { MealPlannerScreen } from "../screens/MealPlannerScreen";
import { PantryFinderScreen } from "../screens/PantryFinderScreen";
import { CustomizeHomeScreen } from "../screens/CustomizeHomeScreen";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { preference, isLoading } = useLocalPreference();
  const { isLoading: isLocaleLoading, t } = useLocale();
  const { colors, isDark, isLoading: isThemeLoading } = useTheme();

  if (isLoading || isLocaleLoading || isThemeLoading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={preference.onboarded ? "Main" : "Onboarding"}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          // Apple-style push: slide in from the right with the outgoing
          // screen parallax-dimming underneath, matching iOS's UINavigationController.
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FeatureTour" component={FeatureTourScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="RecipeList" component={RecipeListScreen} options={{ title: t("recipeList.title") }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: "" }} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} options={{ title: t("shoppingList.title") }} />
        <Stack.Screen
          name="CookMode"
          component={CookModeScreen}
          options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: "modal", title: t("login.headerTitle") }}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ presentation: "modal", title: t("signup.headerTitle") }}
        />
        <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ title: t("glossary.title") }} />
        <Stack.Screen name="Notes" component={NotesListScreen} options={{ title: t("notes.title") }} />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ presentation: "modal", title: t("search.title") }}
        />
        <Stack.Screen
          name="MealPlanner"
          component={MealPlannerScreen}
          options={{ title: t("mealPlanner.title") }}
        />
        <Stack.Screen
          name="PantryFinder"
          component={PantryFinderScreen}
          options={{ title: t("pantryFinder.title") }}
        />
        <Stack.Screen
          name="CustomizeHome"
          component={CustomizeHomeScreen}
          options={{ title: t("customizeHome.title") }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
