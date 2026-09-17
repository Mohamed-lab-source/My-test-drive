import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { useLocale } from "../i18n/LocaleContext";
import { fetchCuisines, fetchRecipes, fetchRecommended } from "../api/endpoints";
import { rankRecipes } from "../utils/rank";
import { RecipeCard } from "../components/RecipeCard";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { Cuisine, RecipeSummary } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { preference } = useLocalPreference();
  const { recentRecipes } = useRecentlyViewed();
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  // Fixed pixel width (not a percentage) so the grid can't misbehave if
  // percentage widths ever interact badly with `gap` in a wrapped row --
  // 3 columns, accounting for the screen's horizontal padding and the two
  // gaps between columns.
  const cuisineCardWidth = (windowWidth - spacing(3) * 2 - spacing(1.5) * 2) / 3;
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [recommended, setRecommended] = useState<RecipeSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [cuisineList] = await Promise.all([fetchCuisines()]);
    setCuisines(cuisineList);

    if (isAuthenticated) {
      setRecommended(await fetchRecommended());
    } else {
      const all = await fetchRecipes({});
      setRecommended(rankRecipes(all, preference.dietGoal, preference.favoriteCuisineSlugs).slice(0, 6));
    }
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

  const greetingName = isAuthenticated ? user?.name.split(" ")[0] : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={recommended}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.greeting}>
                {greetingName ? t("home.greeting", { name: greetingName }) : t("home.greetingGeneric")}
              </Text>
              <Text style={styles.headline}>{t("home.headline")}</Text>
            </View>

            <AnimatedPressable
              style={styles.searchBar}
              pressScale={0.98}
              onPress={() => navigation.navigate("Search")}
              accessibilityRole="button"
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>{t("search.placeholder")}</Text>
            </AnimatedPressable>

            <Text style={styles.sectionTitle}>{t("home.browseByCuisine")}</Text>
            <View style={styles.cuisineWrap}>
              {cuisines.map((c, i) => (
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

            <View style={styles.quickRow}>
              <AnimatedPressable
                style={styles.quickChip}
                pressScale={0.94}
                onPress={() => navigation.navigate("RecipeList", { tag: "DESSERT", title: t("home.dessertsTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.desserts")}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.quickChip}
                pressScale={0.94}
                onPress={() => navigation.navigate("RecipeList", { tag: "FIT", title: t("home.fitTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.fit")}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.quickChip}
                pressScale={0.94}
                onPress={() => navigation.navigate("RecipeList", { tag: "QUICK", title: t("home.quickTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.quick")}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.quickChip}
                pressScale={0.94}
                onPress={() => navigation.navigate("MealPlanner")}
              >
                <Text style={styles.quickChipText}>{t("home.planWeek")}</Text>
              </AnimatedPressable>
            </View>

            {recentRecipes.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>{t("home.recentlyViewed")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
                  {recentRecipes.map((r, i) => (
                    <FadeSlideIn key={r.slug} index={i}>
                      <AnimatedPressable
                        style={styles.recentCard}
                        pressScale={0.96}
                        onPress={() => navigation.navigate("RecipeDetail", { slug: r.slug })}
                      >
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

            <Text style={styles.sectionTitle}>{t("home.recommended")}</Text>
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
    greeting: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    headline: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
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
    cuisineWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing(1.5) },
    cuisineCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing(1),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    cuisineEmoji: { fontSize: 26 },
    cuisineName: { fontWeight: "700", color: colors.text, marginTop: 6, fontSize: 12, textAlign: "center" },
    cuisineCount: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
    quickRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", marginTop: spacing(2), gap: spacing(1) },
    quickChip: {
      backgroundColor: colors.secondary,
      borderRadius: radius.pill,
      paddingVertical: spacing(1),
      paddingHorizontal: spacing(2),
    },
    quickChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
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
    },
    recentEmoji: { fontSize: 28 },
    recentTitle: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: spacing(1), textAlign: "center" },
    recommendedItem: {},
  });
