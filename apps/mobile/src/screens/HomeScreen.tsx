import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useCookStreak } from "../context/CookStreakContext";
import { useFavorites } from "../context/FavoritesContext";
import { useHomeLayout } from "../context/HomeLayoutContext";
import { daysUntil, useLeftovers } from "../context/LeftoversContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useMealPlan } from "../context/MealPlanContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { useLocale } from "../i18n/LocaleContext";
import { fetchCuisines, fetchRandomRecipe, fetchRecipeDetail, fetchRecipes, fetchRecommended } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { boostByCookHistory, rankRecipes } from "../utils/rank";
import { RecipeCard } from "../components/RecipeCard";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { Pulse } from "../components/Pulse";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";
import type { Cuisine, RecipeSummary } from "../api/types";

const RECOMMENDED_TITLE_KEY: Record<string, TranslationKey> = {
  LOSE_WEIGHT: "home.recommendedLoseWeight",
  BUILD_MUSCLE: "home.recommendedBuildMuscle",
  GAIN_WEIGHT: "home.recommendedGainWeight",
};

const MEAL_TYPES: { dishType: string; emoji: string; labelKey: TranslationKey }[] = [
  { dishType: "Breakfast", emoji: "🍳", labelKey: "home.mealType.breakfast" },
  { dishType: "Appetizer", emoji: "🥗", labelKey: "home.mealType.appetizer" },
  { dishType: "Main Course", emoji: "🍽️", labelKey: "home.mealType.mainCourse" },
  { dishType: "Soup", emoji: "🍲", labelKey: "home.mealType.soup" },
  { dishType: "Side Dish", emoji: "🥔", labelKey: "home.mealType.sideDish" },
  { dishType: "Dessert", emoji: "🍰", labelKey: "home.mealType.dessert" },
];

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { displayStreak, cookCounts } = useCookStreak();
  const { favoriteRecipes } = useFavorites();
  const { isVisible: isSectionVisible } = useHomeLayout();
  const { leftovers, removeLeftover } = useLeftovers();
  const { plan } = useMealPlan();
  const { preference } = useLocalPreference();
  const { recentRecipes, removeRecent, clearRecent } = useRecentlyViewed();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  // Fixed pixel width (not a percentage) so the grid can't misbehave if
  // percentage widths ever interact badly with `gap` in a wrapped row --
  // 3 columns, accounting for the screen's horizontal padding and the two
  // gaps between columns.
  const cuisineCardWidth = (windowWidth - spacing(3) * 2 - spacing(1.5) * 2) / 3;
  const actionTileWidth = (windowWidth - spacing(3) * 2 - spacing(1.5) * 3) / 4;
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [recommended, setRecommended] = useState<RecipeSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [surprising, setSurprising] = useState(false);
  const [cookingSlug, setCookingSlug] = useState<string | null>(null);
  const [dailyRecipe, setDailyRecipe] = useState<RecipeSummary | null>(null);

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    fetchRandomRecipe({ seed: todayKey })
      .then(({ slug }) => fetchRecipeDetail(slug))
      .then(setDailyRecipe)
      .catch(() => {});
  }, [locale]);

  const load = useCallback(async () => {
    const [cuisineList] = await Promise.all([fetchCuisines()]);
    setCuisines(cuisineList);

    const knownRecipes = [...recentRecipes, ...favoriteRecipes];
    if (isAuthenticated) {
      const base = await fetchRecommended();
      setRecommended(boostByCookHistory(base, cookCounts, knownRecipes));
    } else {
      const all = await fetchRecipes({});
      const ranked = rankRecipes(all, preference.dietGoal, preference.favoriteCuisineSlugs).slice(0, 6);
      setRecommended(boostByCookHistory(ranked, cookCounts, knownRecipes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, preference]);

  useEffect(() => {
    load().catch(() => {});
    // Re-fetch when the language changes so cuisine/recipe names re-localize.
  }, [load, locale]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const handleSurpriseMe = async () => {
    setSurprising(true);
    try {
      const { slug } = await fetchRandomRecipe();
      navigation.navigate("RecipeDetail", { slug });
    } catch (error) {
      Alert.alert(t("home.surpriseMeError"), apiErrorMessage(error));
    } finally {
      setSurprising(false);
    }
  };

  const handleCookAgain = async (recipe: RecipeSummary) => {
    setCookingSlug(recipe.slug);
    try {
      const detail = await fetchRecipeDetail(recipe.slug);
      navigation.navigate("CookMode", {
        slug: detail.slug,
        title: detail.title,
        cuisineSlug: detail.cuisine.slug,
        steps: detail.steps,
        ingredients: detail.ingredients,
        servings: detail.baseServings,
      });
    } catch (error) {
      Alert.alert(t("home.cookAgainError"), apiErrorMessage(error));
    } finally {
      setCookingSlug(null);
    }
  };

  const handleClearRecent = () => {
    Alert.alert(t("home.clearRecentlyViewedConfirmTitle"), t("home.clearRecentlyViewedConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("home.clearRecentlyViewed"), style: "destructive", onPress: clearRecent },
    ]);
  };

  const greetingName = isAuthenticated ? user?.name.split(" ")[0] : undefined;
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greetingKey: TranslationKey = greetingName
    ? (`home.greeting.${timeOfDay}` as TranslationKey)
    : (`home.greeting.${timeOfDay}Generic` as TranslationKey);
  const dietGoal = isAuthenticated ? user?.preference?.dietGoal ?? "NONE" : preference.dietGoal;
  const todaysPlanRecipe = plan[new Date().toISOString().slice(0, 10)];
  const recommendedTitle = t(RECOMMENDED_TITLE_KEY[dietGoal] ?? "home.recommended");
  const favoriteCuisineSlugs = isAuthenticated
    ? user?.preference?.favoriteCuisineSlugs ?? []
    : preference.favoriteCuisineSlugs;
  const orderedCuisines = useMemo(() => {
    if (favoriteCuisineSlugs.length === 0) return cuisines;
    const favSet = new Set(favoriteCuisineSlugs);
    return [...cuisines].sort((a, b) => Number(favSet.has(b.slug)) - Number(favSet.has(a.slug)));
  }, [cuisines, favoriteCuisineSlugs]);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={recommended}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.greetingRow}>
                <Text style={styles.greeting}>
                  {greetingName ? t(greetingKey, { name: greetingName }) : t(greetingKey)}
                </Text>
                {displayStreak > 0 ? (
                  <Pulse style={styles.streakBadge}>
                    <Text style={styles.streakBadgeText}>🔥 {displayStreak}</Text>
                  </Pulse>
                ) : null}
              </View>
              <Text style={styles.headline}>{t("home.headline")}</Text>
            </View>

            {todaysPlanRecipe ? (
              <AnimatedPressable
                style={styles.todaysPlanCard}
                pressScale={0.98}
                onPress={() => navigation.navigate("RecipeDetail", { slug: todaysPlanRecipe.slug })}
              >
                <View style={styles.todaysPlanTextCol}>
                  <Text style={styles.todaysPlanLabel}>{t("home.todaysPlanLabel")}</Text>
                  <Text style={styles.todaysPlanTitle} numberOfLines={1}>
                    {todaysPlanRecipe.title}
                  </Text>
                </View>
                <AnimatedPressable
                  style={styles.todaysPlanButton}
                  pressScale={0.9}
                  onPress={() => handleCookAgain(todaysPlanRecipe)}
                  disabled={cookingSlug !== null}
                >
                  {cookingSlug === todaysPlanRecipe.slug ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.todaysPlanButtonText}>{t("home.startCooking")}</Text>
                  )}
                </AnimatedPressable>
              </AnimatedPressable>
            ) : null}

            <AnimatedPressable
              style={styles.searchBar}
              pressScale={0.98}
              onPress={() => navigation.navigate("Search")}
              accessibilityRole="button"
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>{t("search.placeholder")}</Text>
            </AnimatedPressable>

            <Text style={styles.sectionTitle}>{t("home.moodTitle")}</Text>
            <View style={styles.moodRow}>
              {[
                {
                  key: "spicy",
                  label: t("home.moodSpicy"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "SPICY", title: t("home.spicyTitle") }),
                },
                {
                  key: "comfort",
                  label: t("home.moodComfort"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "COMFORT", title: t("home.comfortTitle") }),
                },
                {
                  key: "quick",
                  label: t("home.moodQuick"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "QUICK", title: t("home.quickTitle") }),
                },
                {
                  key: "light",
                  label: t("home.moodLight"),
                  onPress: () => navigation.navigate("RecipeList", { title: t("home.lightTitle"), lightOnly: true }),
                },
              ].map((mood, i) => (
                <FadeSlideIn key={mood.key} index={i}>
                  <AnimatedPressable style={styles.moodTile} pressScale={0.92} onPress={mood.onPress}>
                    <Text style={styles.moodTileText}>{mood.label}</Text>
                  </AnimatedPressable>
                </FadeSlideIn>
              ))}
            </View>

            {dailyRecipe && isSectionVisible("recipeOfDay") ? (
              <>
                <Text style={styles.sectionTitle}>{t("home.recipeOfTheDay")}</Text>
                <RecipeCard
                  recipe={dailyRecipe}
                  onPress={() => navigation.navigate("RecipeDetail", { slug: dailyRecipe.slug })}
                />
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{t("home.browseByCuisine")}</Text>
            <View style={styles.cuisineWrap}>
              {orderedCuisines.map((c, i) => (
                <FadeSlideIn key={c.id} index={i}>
                  <AnimatedPressable
                    style={[styles.cuisineCard, { width: cuisineCardWidth, height: cuisineCardWidth }]}
                    pressScale={0.94}
                    onPress={() => navigation.navigate("RecipeList", { cuisineSlug: c.slug, title: c.name })}
                  >
                    <Text style={styles.cuisineEmoji}>{CUISINE_EMOJI[c.slug] ?? "🍽️"}</Text>
                    <Text style={styles.cuisineName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.cuisineCount}>{t("home.recipeCount", { count: c.recipeCount })}</Text>
                  </AnimatedPressable>
                </FadeSlideIn>
              ))}
            </View>

            {isSectionVisible("browseByMealType") ? (
              <>
                <Text style={styles.sectionTitle}>{t("home.browseByMealType")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTypeScroll}>
                  {MEAL_TYPES.map((m, i) => (
                    <FadeSlideIn key={m.dishType} index={i}>
                      <AnimatedPressable
                        style={styles.mealTypeChip}
                        pressScale={0.94}
                        onPress={() =>
                          navigation.navigate("RecipeList", { dishType: m.dishType, title: t(m.labelKey) })
                        }
                      >
                        <Text style={styles.mealTypeEmoji}>{m.emoji}</Text>
                        <Text style={styles.mealTypeLabel}>{t(m.labelKey)}</Text>
                      </AnimatedPressable>
                    </FadeSlideIn>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{t("home.quickActionsTitle")}</Text>
            <View style={styles.actionsGrid}>
              {[
                {
                  key: "desserts",
                  label: t("home.desserts"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "DESSERT", title: t("home.dessertsTitle") }),
                },
                {
                  key: "fit",
                  label: t("home.fit"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "FIT", title: t("home.fitTitle") }),
                },
                {
                  key: "quick",
                  label: t("home.quick"),
                  onPress: () => navigation.navigate("RecipeList", { tag: "QUICK", title: t("home.quickTitle") }),
                },
                { key: "planWeek", label: t("home.planWeek"), onPress: () => navigation.navigate("MealPlanner") },
                {
                  key: "pantryFinder",
                  label: t("home.pantryFinder"),
                  onPress: () => navigation.navigate("PantryFinder"),
                },
                {
                  key: "budgetPicks",
                  label: t("home.budgetPicks"),
                  onPress: () => navigation.navigate("RecipeList", { title: t("home.budgetTitle"), sortByCost: true }),
                },
                {
                  key: "topRated",
                  label: t("home.topRated"),
                  onPress: () =>
                    navigation.navigate("RecipeList", { title: t("home.topRatedTitle"), sortByRating: true }),
                },
                {
                  key: "surpriseMe",
                  label: surprising ? t("home.surprisingLoading") : t("home.surpriseMe"),
                  onPress: handleSurpriseMe,
                  disabled: surprising,
                },
              ].map((action, i) => (
                <FadeSlideIn key={action.key} index={i}>
                  <AnimatedPressable
                    style={[styles.actionTile, { width: actionTileWidth }]}
                    pressScale={0.92}
                    onPress={action.onPress}
                    disabled={action.disabled}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionTileText} numberOfLines={2}>
                      {action.label}
                    </Text>
                  </AnimatedPressable>
                </FadeSlideIn>
              ))}
            </View>

            {leftovers.length > 0 && isSectionVisible("leftovers") ? (
              <>
                <Text style={styles.sectionTitle}>{t("home.leftoversTitle")}</Text>
                {leftovers.map((item, i) => {
                  const remaining = daysUntil(item.useByDate);
                  const statusLabel =
                    remaining < 0
                      ? t("home.leftoversExpired")
                      : remaining === 0
                        ? t("home.leftoversUseToday")
                        : t("home.leftoversUseByDays", { days: remaining });
                  return (
                    <FadeSlideIn key={item.id} index={i}>
                      <View style={styles.leftoverRow}>
                        <AnimatedPressable
                          style={styles.leftoverMain}
                          pressScale={0.98}
                          onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
                        >
                          <Text style={styles.leftoverEmoji}>{CUISINE_EMOJI[item.cuisineSlug] ?? "🍽️"}</Text>
                          <View style={styles.leftoverTextCol}>
                            <Text style={styles.leftoverTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={[styles.leftoverStatus, remaining < 0 && styles.leftoverStatusExpired]}>
                              {statusLabel}
                            </Text>
                          </View>
                        </AnimatedPressable>
                        <AnimatedPressable
                          style={styles.leftoverDoneButton}
                          pressScale={0.85}
                          onPress={() => removeLeftover(item.id)}
                          accessibilityLabel={t("home.leftoversMarkEaten")}
                        >
                          <Text style={styles.leftoverDoneText}>✓</Text>
                        </AnimatedPressable>
                      </View>
                    </FadeSlideIn>
                  );
                })}
              </>
            ) : null}

            {recentRecipes.length > 0 && isSectionVisible("recentlyViewed") ? (
              <>
                <View style={styles.recentHeaderRow}>
                  <Text style={[styles.sectionTitle, styles.recentHeaderTitle]}>{t("home.recentlyViewed")}</Text>
                  <AnimatedPressable pressScale={0.92} onPress={handleClearRecent}>
                    <Text style={styles.clearLink}>{t("home.clearRecentlyViewed")}</Text>
                  </AnimatedPressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
                  {recentRecipes.map((r, i) => (
                    <FadeSlideIn key={r.slug} index={i}>
                      <AnimatedPressable
                        style={styles.recentCard}
                        pressScale={0.96}
                        onPress={() => navigation.navigate("RecipeDetail", { slug: r.slug })}
                      >
                        <AnimatedPressable
                          style={styles.recentRemoveButton}
                          pressScale={0.85}
                          onPress={() => removeRecent(r.slug)}
                          accessibilityLabel={t("home.removeFromRecent")}
                        >
                          <Text style={styles.recentRemoveIcon}>✕</Text>
                        </AnimatedPressable>
                        <AnimatedPressable
                          style={styles.cookAgainButton}
                          pressScale={0.85}
                          onPress={() => handleCookAgain(r)}
                          disabled={cookingSlug !== null}
                          accessibilityLabel={t("home.cookAgain")}
                        >
                          {cookingSlug === r.slug ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.cookAgainIcon}>▶</Text>
                          )}
                        </AnimatedPressable>
                        <Text style={styles.recentEmoji}>{CUISINE_EMOJI[r.cuisine.slug] ?? "🍽️"}</Text>
                        <Text style={styles.recentTitle} numberOfLines={2}>
                          {r.title}
                        </Text>
                      </AnimatedPressable>
                    </FadeSlideIn>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{recommendedTitle}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.recommendedItem}>
            <RecipeCard
              recipe={item}
              index={index}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing(3), paddingBottom: spacing(6) },
    header: { marginBottom: spacing(2) },
    greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    greeting: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    streakBadge: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: 3,
    },
    streakBadgeText: { fontSize: 12, fontWeight: "800", color: colors.primaryDark },
    headline: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
    todaysPlanCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing(1.75),
      marginTop: spacing(2),
      ...shadow.floating,
      shadowColor: colors.primary,
    },
    todaysPlanTextCol: { flex: 1 },
    todaysPlanLabel: { color: "#ffffffcc", fontSize: 11, fontWeight: "700" },
    todaysPlanTitle: { color: "#fff", fontSize: 15, fontWeight: "800", marginTop: 2 },
    todaysPlanButton: {
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(1),
      marginStart: spacing(1),
    },
    todaysPlanButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      marginTop: spacing(1),
    },
    searchIcon: { fontSize: 15, marginEnd: spacing(1) },
    searchPlaceholder: { color: colors.textMuted, fontSize: 14 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1.5) },
    moodRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing(1) },
    moodTile: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
    },
    moodTileText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
    cuisineWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing(1.5) },
    cuisineCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing(1),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cuisineEmoji: { fontSize: 26 },
    cuisineName: { fontWeight: "700", color: colors.text, marginTop: 6, fontSize: 12, textAlign: "center" },
    cuisineCount: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing(1.5) },
    actionTile: {
      aspectRatio: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing(1),
      ...shadow.card,
    },
    actionTileText: { color: colors.text, fontWeight: "700", fontSize: 12, textAlign: "center" },
    leftoverRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginBottom: spacing(1),
    },
    leftoverMain: { flex: 1, flexDirection: "row", alignItems: "center" },
    leftoverEmoji: { fontSize: 24, marginEnd: spacing(1.5) },
    leftoverTextCol: { flex: 1 },
    leftoverTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    leftoverStatus: { fontSize: 12, color: colors.secondary, fontWeight: "600", marginTop: 2 },
    leftoverStatusExpired: { color: colors.danger },
    leftoverDoneButton: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginStart: spacing(1),
    },
    leftoverDoneText: { color: colors.primaryDark, fontWeight: "800", fontSize: 15 },
    mealTypeScroll: {},
    mealTypeChip: {
      width: 84,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing(1.5),
      marginEnd: spacing(1.25),
      alignItems: "center",
    },
    mealTypeEmoji: { fontSize: 24 },
    mealTypeLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 4, textAlign: "center" },
    recentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing(3),
      marginBottom: spacing(1.5),
    },
    recentHeaderTitle: { marginTop: 0, marginBottom: 0 },
    clearLink: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
    recentScroll: {},
    recentCard: {
      width: 110,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginEnd: spacing(1.5),
      alignItems: "center",
      position: "relative",
    },
    recentEmoji: { fontSize: 28 },
    recentTitle: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: spacing(1), textAlign: "center" },
    cookAgainButton: {
      position: "absolute",
      top: spacing(0.75),
      end: spacing(0.75),
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    cookAgainIcon: { color: "#fff", fontSize: 10 },
    recentRemoveButton: {
      position: "absolute",
      top: spacing(0.75),
      start: spacing(0.75),
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    recentRemoveIcon: { color: colors.textMuted, fontSize: 10, fontWeight: "800" },
    recommendedItem: {},
  });
