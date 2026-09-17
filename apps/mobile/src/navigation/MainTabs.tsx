import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/HomeScreen";
import { ListsScreen } from "../screens/ListsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { useLocale } from "../i18n/LocaleContext";
import { colors } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🏠",
  Lists: "🧾",
  Profile: "👤",
};

export function MainTabs() {
  const { t } = useLocale();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("tabs.home") }} />
      <Tab.Screen name="Lists" component={ListsScreen} options={{ title: t("tabs.lists") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile") }} />
    </Tab.Navigator>
  );
}
