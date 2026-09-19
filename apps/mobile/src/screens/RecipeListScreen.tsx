import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { Chip } from "../components/Chip";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { intersectAllergens } from "../utils/allergens";
import { spacing, type ThemeColors } from "../theme";
import type { Difficulty, DishTag, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeList">;

export function RecipeListScreen({ route, navigation }: Props) {
  const { cuisineSlug, tag: initialTag, dishType, title, sortByCost, sortByRating } = route.params;
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTag, setActiveTag] = useState<DishTag | undefined>(initialTag as DishTag | undefined);
  const [sortMode, setSortMode] = useState<"none" | "cheapest" | "topRated" | "fastest">(
    sortByRating ? "topRated" : sortByCost ? "cheapest" : "none"
  );
  const [hideAllergens, setHideAllergens] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | undefined>(undefined);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const myAllergies = user?.preference?.allergies ?? [];
  const allergenFiltered = hideAllergens
    ? recipes.filter((r) => intersectAllergens(r.allergens, myAllergies).length === 0)
    : recipes;
  const filteredRecipes = difficultyFilter
    ? allergenFiltered.filter((r) => r.difficulty === difficultyFilter)
    : allergenFiltered;

  const displayRecipes =
    sortMode === "cheapest"
      ? [...filteredRecipes].sort((a, b) => a.costPerServing - b.costPerServing)
      : sortMode === "topRated"
        ? [...filteredRecipes].sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1))
        : sortMode === "fastest"
          ? [...filteredRecipes].sort(
              (a, b) => a.prepMinutes + a.cookMinutes - (b.prepMinutes + b.cookMinutes)
            )
          : filteredRecipes;

  const DIFFICULTY_FILTERS: { value: Difficulty | undefined; label: string }[] = [
    { value: undefined, label: t("recipeList.filter.all") },
    { value: "EASY", label: t("difficulty.EASY") },
    { value: "MEDIUM", label: t("difficulty.MEDIUM") },
    { value: "HARD", label: t("difficulty.HARD") },
  ];

  const TAG_FILTERS: { value: DishTag | undefined; label: string }[] = [
    { value: undefined, label: t("recipeList.filter.all") },
    { value: "FIT", label: t("recipeList.filter.fit") },
    { value: "DESSERT", label: t("recipeList.filter.dessert") },
    { value: "VEGETARIAN", label: t("recipeList.filter.vegetarian") },
    { value: "QUICK", label: t("recipeList.filter.quick") },
    { value: "SPICY", label: t("recipeList.filter.spicy") },
    { value: "COMFORT", label: t("recipeList.filter.comfort") },
  ];

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    setLoading(true);
    fetchRecipes({ cuisine: cuisineSlug, tag: activeTag, dishType })
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [cuisineSlug, activeTag, dishType, locale]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.filterRow}>
        {TAG_FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} selected={activeTag === f.value} onPress={() => setActiveTag(f.value)} />
        ))}
      </View>
      <View style={styles.filterRowSecondary}>
        <Chip
          label={t("recipeList.filter.cheapestFirst")}
          selected={sortMode === "cheapest"}
          onPress={() => setSortMode((m) => (m === "cheapest" ? "none" : "cheapest"))}
        />
        <Chip
          label={t("recipeList.filter.topRated")}
          selected={sortMode === "topRated"}
          onPress={() => setSortMode((m) => (m === "topRated" ? "none" : "topRated"))}
        />
        <Chip
          label={t("recipeList.filter.fastestFirst")}
          selected={sortMode === "fastest"}
          onPress={() => setSortMode((m) => (m === "fastest" ? "none" : "fastest"))}
        />
        {myAllergies.length > 0 ? (
          <Chip
            label={t("recipeList.filter.hideAllergens")}
            selected={hideAllergens}
            onPress={() => setHideAllergens((v) => !v)}
          />
        ) : null}
      </View>
      <View style={styles.filterRowSecondary}>
        {DIFFICULTY_FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            selected={difficultyFilter === f.value}
            onPress={() => setDifficultyFilter(f.value)}
          />
        ))}
      </View>
      <FlatList
        data={displayRecipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <RecipeCard
            recipe={item}
            index={index}
            onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
          />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t("recipeList.empty")}</Text> : null}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: spacing(3), paddingTop: spacing(2) },
    filterRowSecondary: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: spacing(3) },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4) },
  });
