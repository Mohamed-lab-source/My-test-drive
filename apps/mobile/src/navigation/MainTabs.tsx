import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import type { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/HomeScreen";
import { ListsScreen } from "../screens/ListsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🏠",
  Lists: "🧾",
  Profile: "👤",
};

function TabIcon({ name, focused }: { name: keyof MainTabParamList; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 14,
    }).start();
  }, [focused]);

  return (
    <Animated.Text style={{ fontSize: 18, transform: [{ scale }] }}>{ICONS[name]}</Animated.Text>
  );
}

export function MainTabs() {
  const { t } = useLocale();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("tabs.home") }} />
      <Tab.Screen name="Lists" component={ListsScreen} options={{ title: t("tabs.lists") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile") }} />
    </Tab.Navigator>
  );
}
