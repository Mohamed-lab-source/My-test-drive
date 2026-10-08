import React, { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchIngredients, fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { RecipeCardSkeleton } from "../components/Skeleton";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { intersectAllergens, useMyAllergies } from "../utils/allergens";
import { spacing, type ThemeColors } from "../theme";
import type { Difficulty, DishTag, PantryIngredient, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeList">;

type TimeBucket = "under15" | "15to30" | "30to60" | "over60";

const LIGHT_CALORIE_THRESHOLD = 400;
const FEW_INGREDIENTS_THRESHOLD = 6;
const CACHE_PREFIX = "cookmate.recipeListCache.";

function timeBucketFromMaxMinutes(max?: number): TimeBucket | undefined {
  if (max === 15) return "under15";
  if (max === 30) return "15to30";
  if (max === 60) return "30to60";
  if (max === 999) return "over60";
  return undefined;
}

export function RecipeListScreen({ route, navigation }: Props) {
  const {
    cuisineSlug,
    tag: initialTag,
    dishType,
    occasion,
    title,
    sortByCost,
    sortByRating,
    lightOnly: initialLightOnly,
    maxTotalMinutes,
  } = route.params;
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTag, setActiveTag] = useState<DishTag | undefined>(initialTag as DishTag | undefined);
  const [sortMode, setSortMode] = useState<"none" | "cheapest" | "topRated" | "fastest">(
    sortByRating ? "topRated" : sortByCost ? "cheapest" : "none"
  );
  const [hideAllergens, setHideAllergens] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | undefined>(undefined);
  const [lightOnly, setLightOnly] = useState(!!initialLightOnly);
  const [fewIngredientsOnly, setFewIngredientsOnly] = useState(false);
  const [timeBucket, setTimeBucket] = useState<TimeBucket | undefined>(
    timeBucketFromMaxMinutes(maxTotalMinutes)
  );
  const [ingredientsPanelOpen, setIngredientsPanelOpen] = useState(false);
  const [allIngredients, setAllIngredients] = useState<PantryIngredient[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const myAllergies = useMyAllergies();
  const allergenFiltered = hideAllergens
    ? recipes.filter((r) => intersectAllergens(r.allergens, myAllergies).length === 0)
    : recipes;
  const difficultyFiltered = difficultyFilter
    ? allergenFiltered.filter((r) => r.difficulty === difficultyFilter)
    : allergenFiltered;
  const lightFiltered = lightOnly
    ? difficultyFiltered.filter((r) => r.caloriesPerServing <= LIGHT_CALORIE_THRESHOLD)
    : difficultyFiltered;
  const fewIngredientsFiltered = fewIngredientsOnly
    ? lightFiltered.filter((r) => r.ingredientCount <= FEW_INGREDIENTS_THRESHOLD)
    : lightFiltered;
  const filteredRecipes = timeBucket
    ? fewIngredientsFiltered.filter((r) => {
        const total = r.prepMinutes + r.cookMinutes;
        if (timeBucket === "under15") return total <= 15;
        if (timeBucket === "15to30") return total > 15 && total <= 30;
        if (timeBucket === "30to60") return total > 30 && total <= 60;
        return total > 60;
      })
    : fewIngredientsFiltered;

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

  const TIME_BUCKET_FILTERS: { value: TimeBucket; label: string }[] = [
    { value: "under15", label: t("home.cookTimeUnder15") },
    { value: "15to30", label: t("home.cookTime15to30") },
    { value: "30to60", label: t("home.cookTime30to60") },
    { value: "over60", label: t("home.cookTimeOver60") },
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

  const ingredientsParam = selectedIngredientIds.length > 0 ? selectedIngredientIds.join(",") : undefined;
  const cacheKey = `${CACHE_PREFIX}${locale}.${cuisineSlug ?? ""}.${activeTag ?? ""}.${dishType ?? ""}.${occasion ?? ""}.${ingredientsParam ?? ""}`;
  const [showingOfflineCache, setShowingOfflineCache] = useState(false);

  useEffect(() => {
    fetchIngredients()
      .then(setAllIngredients)
      .catch(() => {});
  }, []);

  const loadRecipes = () => {
    setLoading(true);
    fetchRecipes({ cuisine: cuisineSlug, tag: activeTag, dishType, occasion, ingredients: ingredientsParam })
      .then((data) => {
        setRecipes(data);
        setLoadError(false);
        setShowingOfflineCache(false);
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
      })
      .catch(async () => {
        const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
        if (cached) {
          setRecipes(JSON.parse(cached) as RecipeSummary[]);
          setShowingOfflineCache(true);
        } else {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisineSlug, activeTag, dishType, occasion, locale, ingredientsParam]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes({ cuisine: cuisineSlug, tag: activeTag, dishType, occasion, ingredients: ingredientsParam })
      .then((data) => {
        setRecipes(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setRefreshing(false));
  };

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
        <Chip
          label={t("recipeList.filter.lightOnly")}
          selected={lightOnly}
          onPress={() => setLightOnly((v) => !v)}
        />
        <Chip
          label={t("recipeList.filter.fewIngredients")}
          selected={fewIngredientsOnly}
          onPress={() => setFewIngredientsOnly((v) => !v)}
        />
      </View>
      <View style={styles.filterRowSecondary}>
        {TIME_BUCKET_FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            selected={timeBucket === f.value}
            onPress={() => setTimeBucket((v) => (v === f.value ? undefined : f.value))}
          />
        ))}
        <Chip
          label={t("recipeList.filter.ingredientsIHave")}
          selected={ingredientsPanelOpen || selectedIngredientIds.length > 0}
          onPress={() => setIngredientsPanelOpen((v) => !v)}
        />
      </View>
      {ingredientsPanelOpen ? (
        <View style={styles.ingredientsPanel}>
          <TextInput
            style={[styles.ingredientSearchInput, { textAlign: isRTL ? "right" : "left" }]}
            placeholder={t("recipeList.filter.ingredientsSearchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={ingredientQuery}
            onChangeText={setIngredientQuery}
            autoCorrect={false}
          />
          {ingredientQuery.trim() ? (
            <View style={styles.ingredientSuggestionWrap}>
              {allIngredients
                .filter((i) => i.name.toLowerCase().includes(ingredientQuery.trim().toLowerCase()))
                .slice(0, 8)
                .map((ing) => (
                  <AnimatedPressable
                    key={ing.id}
                    style={styles.selectedChip}
                    pressScale={0.95}
                    onPress={() => {
                      setSelectedIngredientIds((prev) =>
                        prev.includes(ing.id) ? prev : [...prev, ing.id]
                      );
                      setIngredientQuery("");
                    }}
                  >
                    <Text style={styles.selectedChipText}>{ing.name} +</Text>
                  </AnimatedPressable>
                ))}
            </View>
          ) : null}
          {selectedIngredientIds.length > 0 ? (
            <View style={styles.ingredientSuggestionWrap}>
              {allIngredients
                .filter((i) => selectedIngredientIds.includes(i.id))
                .map((ing) => (
                  <AnimatedPressable
                    key={ing.id}
                    style={styles.selectedChip}
                    pressScale={0.95}
                    accessibilityLabel={t("recipeList.filter.removeIngredient", { name: ing.name })}
                    accessibilityRole="button"
                    onPress={() =>
                      setSelectedIngredientIds((prev) => prev.filter((id) => id !== ing.id))
                    }
                  >
                    <Text style={styles.selectedChipText}>{ing.name} ✕</Text>
                  </AnimatedPressable>
                ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={displayRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            showingOfflineCache ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>{t("recipeList.offlineBanner")}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <RecipeCard
              recipe={item}
              index={index}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            />
          )}
          ListEmptyComponent={
            loadError ? (
              <View style={styles.errorState}>
                <EmptyState icon="⚠️" message={t("recipeList.loadError")} />
                <Chip label={t("recipeDetail.retry")} onPress={loadRecipes} />
              </View>
            ) : (
              <EmptyState icon="🔍" message={t("recipeList.empty")} />
            )
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: spacing(3), paddingTop: spacing(2) },
    filterRowSecondary: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: spacing(3) },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    errorState: { alignItems: "center", gap: spacing(1.5) },
    offlineBanner: {
      backgroundColor: colors.chipBackground,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      marginBottom: spacing(1.5),
    },
    offlineBannerText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
    ingredientsPanel: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing(3),
      marginTop: spacing(1.5),
      padding: spacing(1.5),
    },
    ingredientSearchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      color: colors.text,
      fontSize: 14,
    },
    ingredientSuggestionWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", marginTop: spacing(1.25) },
    selectedChip: {
      backgroundColor: colors.chipBackground,
      borderRadius: 999,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      marginEnd: spacing(1),
      marginBottom: spacing(1),
    },
    selectedChipText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
  });
