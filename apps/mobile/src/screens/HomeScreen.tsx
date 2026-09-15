import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { fetchCuisines, fetchRecipes, fetchRecommended } from "../api/endpoints";
import { rankRecipes } from "../utils/rank";
import { RecipeCard } from "../components/RecipeCard";
import { colors, radius, spacing } from "../theme";
import type { Cuisine, RecipeSummary } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

const CUISINE_EMOJI: Record<string, string> = {
  italian: "🍝",
  asian: "🍜",
  egyptian: "🍲",
};

export function HomeScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { preference } = useLocalPreference();
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
  }, [load]);

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
              <Text style={styles.greeting}>{greetingName ? `Hey ${greetingName} 👋` : "Hey there 👋"}</Text>
              <Text style={styles.headline}>What are we cooking today?</Text>
            </View>

            <Text style={styles.sectionTitle}>Browse by cuisine</Text>
            <View style={styles.cuisineRow}>
              {cuisines.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.cuisineCard}
                  onPress={() => navigation.navigate("RecipeList", { cuisineSlug: c.slug, title: c.name })}
                >
                  <Text style={styles.cuisineEmoji}>{CUISINE_EMOJI[c.slug] ?? "🍽️"}</Text>
                  <Text style={styles.cuisineName}>{c.name}</Text>
                  <Text style={styles.cuisineCount}>{c.recipeCount} recipes</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.quickRow}>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "DESSERT", title: "Desserts" })}
              >
                <Text style={styles.quickChipText}>🍰 Desserts</Text>
              </Pressable>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "FIT", title: "Fit & healthy" })}
              >
                <Text style={styles.quickChipText}>💪 Fit & healthy</Text>
              </Pressable>
              <Pressable
                style={styles.quickChip}
                onPress={() => navigation.navigate("RecipeList", { tag: "QUICK", title: "Quick meals" })}
              >
                <Text style={styles.quickChipText}>⚡ Quick</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Recommended for you</Text>
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
  cuisineRow: { flexDirection: "row", justifyContent: "space-between" },
  cuisineCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginRight: spacing(1),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cuisineEmoji: { fontSize: 28 },
  cuisineName: { fontWeight: "700", color: colors.text, marginTop: 6, fontSize: 13 },
  cuisineCount: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
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
