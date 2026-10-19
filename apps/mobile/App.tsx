import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { LocalPreferenceProvider } from "./src/context/LocalPreferenceContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import { UnitsProvider } from "./src/context/UnitsContext";
import { RecentlyViewedProvider } from "./src/context/RecentlyViewedContext";
import { RecentlyRatedProvider } from "./src/context/RecentlyRatedContext";
import { NotesProvider } from "./src/context/NotesContext";
import { MealPlanProvider } from "./src/context/MealPlanContext";
import { MealReminderProvider } from "./src/context/MealReminderContext";
import { CookStreakProvider } from "./src/context/CookStreakContext";
import { LeftoversProvider } from "./src/context/LeftoversContext";
import { HomeLayoutProvider } from "./src/context/HomeLayoutContext";
import { TextSizeProvider } from "./src/context/TextSizeContext";
import { AccessibilityPrefsProvider } from "./src/context/AccessibilityPrefsContext";
import { ToastProvider } from "./src/context/ToastContext";
import { PantryCheckProvider } from "./src/context/PantryCheckContext";
import { WhatsNewProvider } from "./src/context/WhatsNewContext";
import { CollectionsProvider } from "./src/context/CollectionsContext";
import { BadgesProvider } from "./src/context/BadgesContext";
import { FoodDiaryProvider } from "./src/context/FoodDiaryContext";
import { ShoppingExtrasProvider } from "./src/context/ShoppingExtrasContext";
import { HouseholdProvider } from "./src/context/HouseholdContext";
import { HiddenRecipesProvider } from "./src/context/HiddenRecipesContext";
import { KitchenTimersProvider } from "./src/context/KitchenTimersContext";
import { CookingJournalProvider } from "./src/context/CookingJournalContext";
import { GoalsProvider } from "./src/context/GoalsContext";
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
                    <RecentlyRatedProvider>
                      <NotesProvider>
                        <MealPlanProvider>
                          <MealReminderProvider>
                            <CookStreakProvider>
                              <LeftoversProvider>
                                <HomeLayoutProvider>
                                  <TextSizeProvider>
                                    <AccessibilityPrefsProvider>
                                      <ToastProvider>
                                        <PantryCheckProvider>
                                          <WhatsNewProvider>
                                            <CollectionsProvider>
                                              <FoodDiaryProvider>
                                                <ShoppingExtrasProvider>
                                                  <HouseholdProvider>
                                                    <HiddenRecipesProvider>
                                                      <KitchenTimersProvider>
                                                        <CookingJournalProvider>
                                                          <GoalsProvider>
                                                            <BadgesProvider>
                                                              <AppShell />
                                                            </BadgesProvider>
                                                          </GoalsProvider>
                                                        </CookingJournalProvider>
                                                      </KitchenTimersProvider>
                                                    </HiddenRecipesProvider>
                                                  </HouseholdProvider>
                                                </ShoppingExtrasProvider>
                                              </FoodDiaryProvider>
                                            </CollectionsProvider>
                                          </WhatsNewProvider>
                                        </PantryCheckProvider>
                                      </ToastProvider>
                                    </AccessibilityPrefsProvider>
                                  </TextSizeProvider>
                                </HomeLayoutProvider>
                              </LeftoversProvider>
                            </CookStreakProvider>
                          </MealReminderProvider>
                        </MealPlanProvider>
                      </NotesProvider>
                    </RecentlyRatedProvider>
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
