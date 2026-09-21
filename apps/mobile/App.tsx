import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { LocalPreferenceProvider } from "./src/context/LocalPreferenceContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import { UnitsProvider } from "./src/context/UnitsContext";
import { RecentlyViewedProvider } from "./src/context/RecentlyViewedContext";
import { NotesProvider } from "./src/context/NotesContext";
import { MealPlanProvider } from "./src/context/MealPlanContext";
import { CookStreakProvider } from "./src/context/CookStreakContext";
import { LeftoversProvider } from "./src/context/LeftoversContext";
import { HomeLayoutProvider } from "./src/context/HomeLayoutContext";
import { LocaleProvider } from "./src/i18n/LocaleContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

function AppShell() {
  const { isDark } = useTheme();
  return (
    <>
      <RootNavigator />
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <UnitsProvider>
            <LocalPreferenceProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <RecentlyViewedProvider>
                    <NotesProvider>
                      <MealPlanProvider>
                        <CookStreakProvider>
                          <LeftoversProvider>
                            <HomeLayoutProvider>
                              <AppShell />
                            </HomeLayoutProvider>
                          </LeftoversProvider>
                        </CookStreakProvider>
                      </MealPlanProvider>
                    </NotesProvider>
                  </RecentlyViewedProvider>
                </FavoritesProvider>
              </AuthProvider>
            </LocalPreferenceProvider>
          </UnitsProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
