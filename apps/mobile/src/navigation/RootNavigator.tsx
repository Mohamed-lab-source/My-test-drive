import React from "react";
import { ActivityIndicator, SafeAreaView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { RecipeListScreen } from "../screens/RecipeListScreen";
import { RecipeDetailScreen } from "../screens/RecipeDetailScreen";
import { ShoppingListScreen } from "../screens/ShoppingListScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { SignupScreen } from "../screens/SignupScreen";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { preference, isLoading } = useLocalPreference();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={preference.onboarded ? "Main" : "Onboarding"}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="RecipeList" component={RecipeListScreen} options={{ title: "Recipes" }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: "" }} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} options={{ title: "Shopping List" }} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: "modal", title: "Log in" }}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ presentation: "modal", title: "Sign up" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
