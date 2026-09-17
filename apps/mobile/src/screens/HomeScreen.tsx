import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useLocale } from "../i18n/LocaleContext";
import { fetchCuisines, fetchRecipes, fetchRecommended } from "../api/endpoints";
import { rankRecipes } from "../utils/rank";
import { RecipeCard } from "../components/RecipeCard";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { colors, radius, spacing } from "../theme";
import type { Cuisine, RecipeSummary } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { preference } = useLocalPreference();
  const { t, locale } = useLocale();
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

            <Text style={styles.sectionTitle}>{t("home.browseByCuisine")}</Text>
            <View style={styles.cuisineWrap}>
              {cuisines.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.cuisineCard}
                  onPress={() => navigation.navigate("RecipeList", { cuisineSlug: c.slug, title: c.name })}
                >
                  <Text style={styles.cuisineEmoji}>{CUISINE_EMOJI[c.slug] ?? "🍽️"}</Text>
                  <Text style={styles.cuisineName}>{c.name}</Text>
                  <Text style={styles.cuisineCount}>{t("home.recipeCount", { count: c.recipeCount })}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.quickRow}>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "DESSERT", title: t("home.dessertsTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.desserts")}</Text>
              </Pressable>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "FIT", title: t("home.fitTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.fit")}</Text>
              </Pressable>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "QUICK", title: t("home.quickTitle") })}
              >
                <Text style={styles.quickChipText}>{t("home.quick")}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>{t("home.recommended")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.recommendedItem}>
            <RecipeCard recipe={item} onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(3), paddingBottom: spacing(6) },
  header: { marginBottom: spacing(2) },
  greeting: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  headline: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1.5) },
  cuisineWrap: { flexDirection: "row", flexWrap: "wrap" },
  cuisineCard: {
    width: "31%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginRight: "3%",
    marginBottom: spacing(1.5),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cuisineEmoji: { fontSize: 28 },
  cuisineName: { fontWeight: "700", color: colors.text, marginTop: 6, fontSize: 12, textAlign: "center" },
  cuisineCount: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing(2) },
  quickChip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  quickChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  recommendedItem: {},
});
