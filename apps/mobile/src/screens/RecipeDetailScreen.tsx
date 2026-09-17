import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipeDetail, rateRecipe } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PopOnChange } from "../components/PopOnChange";
import { ShareableRecipeCard } from "../components/ShareableRecipeCard";
import { StarRating } from "../components/StarRating";
import { useLocale } from "../i18n/LocaleContext";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { useUnits } from "../context/UnitsContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { formatQuantity } from "../utils/units";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeDetail } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { unitSystem } = useUnits();
  const { isAuthenticated } = useAuth();
  const { addRecent } = useRecentlyViewed();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(1);
  const [sharing, setSharing] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [rating, setRating] = useState(false);
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    setLoading(true);
    fetchRecipeDetail(slug)
      .then((data) => {
        setRecipe(data);
        setServings((prev) => (prev === 1 ? data.baseServings : prev));
        setMyRating(data.myRating);
        addRecent(data);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locale]);

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const scale = servings / recipe.baseServings;
    return recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: round2(ing.quantity * scale),
    }));
  }, [recipe, servings]);

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const textAlign = isRTL ? "right" : "left";

  const handleShare = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 0.92 });
      const canShareFile = Platform.OS !== "web" && (await Sharing.isAvailableAsync());
      if (canShareFile) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("share.dialogTitle") });
      } else {
        await Share.share({ message: `${recipe.title}\n\n${recipe.description}` });
      }
    } catch {
      Alert.alert(t("share.error"));
    } finally {
      setSharing(false);
    }
  };

  const handleRate = async (score: number) => {
    const previous = myRating;
    setMyRating(score);
    setRating(true);
    try {
      const result = await rateRecipe(recipe.slug, score);
      setRecipe((prev) => (prev ? { ...prev, avgRating: result.average, ratingCount: result.count } : prev));
    } catch {
      setMyRating(previous);
      Alert.alert(t("recipeDetail.rateError"));
    } finally {
      setRating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView>
        <View style={styles.hero}>
          <FadeSlideIn>
            <Text style={styles.heroEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
          </FadeSlideIn>
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.titleFlex, { textAlign }]}>{recipe.title}</Text>
            <AnimatedPressable
              style={styles.favoriteButton}
              pressScale={0.85}
              onPress={() => toggleFavorite(recipe)}
            >
              <Text style={styles.favoriteIcon}>{isFavorite(recipe.slug) ? "❤️" : "🤍"}</Text>
            </AnimatedPressable>
          </View>
          <Text style={[styles.description, { textAlign }]}>{recipe.description}</Text>

          {recipe.ratingCount > 0 ? (
            <View style={styles.avgRatingRow}>
              <StarRating value={recipe.avgRating ?? 0} size={16} />
              <Text style={styles.avgRatingText}>
                {recipe.avgRating?.toFixed(1)} · {t("recipeDetail.ratingCount", { count: recipe.ratingCount })}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <MetaPill label={`${recipe.cuisine.name}`} styles={styles} />
            <MetaPill label={recipe.dishType} styles={styles} />
            <MetaPill label={`${totalMinutes} ${t("recipeDetail.min")}`} styles={styles} />
            <MetaPill label={recipe.difficulty} styles={styles} />
            <MetaPill label={t("recipeDetail.serves", { count: recipe.baseServings })} styles={styles} />
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.nutrition")}</Text>
          <View style={styles.nutritionRow}>
            <NutritionStat
              label={t("recipeDetail.calories")}
              value={`${recipe.nutritionPerServing.calories}`}
              unit={t("recipeDetail.kcal")}
              styles={styles}
            />
            <NutritionStat
              label={t("recipeDetail.protein")}
              value={`${recipe.nutritionPerServing.proteinGrams}`}
              unit={t("recipeDetail.gramsUnit")}
              styles={styles}
            />
            <NutritionStat
              label={t("recipeDetail.fat")}
              value={`${recipe.nutritionPerServing.fatGrams}`}
              unit={t("recipeDetail.gramsUnit")}
              styles={styles}
            />
            <NutritionStat
              label={t("recipeDetail.carbs")}
              value={`${recipe.nutritionPerServing.carbsGrams}`}
              unit={t("recipeDetail.gramsUnit")}
              styles={styles}
            />
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.servingsQuestion")}</Text>
          <View style={styles.stepperRow}>
            <AnimatedPressable
              style={styles.stepperButton}
              pressScale={0.88}
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              accessibilityRole="button"
              accessibilityLabel={t("recipeDetail.fewerPeople")}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </AnimatedPressable>
            <PopOnChange changeKey={servings}>
              <Text style={styles.stepperValue}>{servings}</Text>
            </PopOnChange>
            <AnimatedPressable
              style={styles.stepperButton}
              pressScale={0.88}
              onPress={() => setServings((s) => Math.min(50, s + 1))}
              accessibilityRole="button"
              accessibilityLabel={t("recipeDetail.morePeople")}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </AnimatedPressable>
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("recipeDetail.ingredientsFor", { count: servings })}
          </Text>
          {scaledIngredients.map((ing, i) => (
            <FadeSlideIn key={ing.name} index={i}>
              <View style={styles.ingredientCell}>
                <View style={styles.ingredientRow}>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                  <Text style={styles.ingredientQty}>{formatQuantity(ing.quantity, ing.unit, unitSystem)}</Text>
                </View>
                {ing.substitute ? (
                  <Text style={[styles.ingredientSubstitute, { textAlign }]}>
                    {t("recipeDetail.substituteHint", { substitute: ing.substitute })}
                  </Text>
                ) : null}
              </View>
            </FadeSlideIn>
          ))}

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.steps")}</Text>
          {recipe.steps.map((step, i) => (
            <FadeSlideIn key={step.order} index={i}>
              <View style={styles.stepCard}>
                <View style={styles.stepBody}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{step.order}</Text>
                    </View>
                    {step.timerMinutes ? (
                      <Text style={styles.stepTimer}>
                        ⏱ {step.timerMinutes} {t("recipeDetail.min")}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.stepInstruction, { textAlign }]}>{step.instruction}</Text>
                </View>
              </View>
            </FadeSlideIn>
          ))}

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.rateThis")}</Text>
          {isAuthenticated ? (
            <View style={styles.rateRow}>
              <StarRating value={myRating ?? 0} onChange={handleRate} size={30} />
              {rating ? <ActivityIndicator size="small" color={colors.primary} style={styles.rateSpinner} /> : null}
            </View>
          ) : (
            <Text style={[styles.rateLoginHint, { textAlign }]}>{t("recipeDetail.rateLoginHint")}</Text>
          )}
        </View>
      </ScrollView>
      <View style={styles.offScreen} pointerEvents="none">
        <ShareableRecipeCard
          ref={shareCardRef}
          recipe={recipe}
          servings={servings}
          ingredients={scaledIngredients}
          ingredientsLabel={t("recipeDetail.ingredientsFor", { count: servings })}
          stepsLabel={t("recipeDetail.steps")}
          servesLabel={t("recipeDetail.serves", { count: servings })}
          brandingLabel={t("share.branding")}
          isRTL={isRTL}
        />
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={t("cookMode.startCooking")}
          onPress={() =>
            navigation.navigate("CookMode", {
              title: recipe.title,
              cuisineSlug: recipe.cuisine.slug,
              steps: recipe.steps,
              ingredients: scaledIngredients,
              servings,
            })
          }
        />
        <View style={styles.shareButton}>
          <PrimaryButton
            label={t("recipeDetail.planShoppingList")}
            variant="outline"
            onPress={() =>
              navigation.navigate("ShoppingList", {
                slug: recipe.slug,
                title: recipe.title,
                baseServings: recipe.baseServings,
                initialServings: servings,
              })
            }
          />
        </View>
        <View style={styles.shareButton}>
          <PrimaryButton label={t("share.button")} onPress={handleShare} loading={sharing} variant="outline" />
        </View>
      </View>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function NutritionStat({
  label,
  value,
  unit,
  styles,
}: {
  label: string;
  value: string;
  unit: string;
  styles: Styles;
}) {
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>
        {value}
        <Text style={styles.nutritionUnit}> {unit}</Text>
      </Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

function MetaPill({ label, styles }: { label: string; styles: Styles }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingSafe: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  hero: {
    width: "100%",
    height: 200,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 72 },
  content: { padding: spacing(3), paddingBottom: spacing(2) },
  titleRow: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  titleFlex: { flex: 1 },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
    marginStart: spacing(1),
  },
  favoriteIcon: { fontSize: 18 },
  description: { color: colors.textMuted, marginTop: spacing(1), lineHeight: 20 },
  avgRatingRow: { flexDirection: "row", alignItems: "center", marginTop: spacing(1) },
  avgRatingText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginStart: spacing(1) },
  rateRow: { flexDirection: "row", alignItems: "center" },
  rateSpinner: { marginStart: spacing(1.5) },
  rateLoginHint: { color: colors.textMuted, fontSize: 13 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", marginTop: spacing(2) },
  metaPill: {
    backgroundColor: colors.chipBackground,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 6,
    marginEnd: spacing(1),
    marginBottom: spacing(1),
  },
  metaPillText: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1.5) },
  nutritionRow: { flexDirection: "row", justifyContent: "space-between" },
  nutritionStat: {
    flex: 1,
    backgroundColor: colors.chipBackground,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    alignItems: "center",
    marginEnd: spacing(1),
  },
  nutritionValue: { fontSize: 16, fontWeight: "800", color: colors.primaryDark },
  nutritionUnit: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  nutritionLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ingredientCell: {
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ingredientName: { color: colors.text, fontSize: 14 },
  ingredientQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  ingredientSubstitute: { color: colors.primaryDark, fontSize: 12, marginTop: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center" },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 20, fontWeight: "800", color: colors.primaryDark },
  stepperValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginHorizontal: spacing(3) },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBody: { padding: spacing(1.5) },
  stepHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepTimer: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  stepInstruction: { color: colors.text, marginTop: spacing(1), lineHeight: 20 },
  footer: {
    padding: spacing(2),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareButton: { marginTop: spacing(1.5) },
  offScreen: { position: "absolute", top: -9999, left: 0, opacity: 0 },
});
