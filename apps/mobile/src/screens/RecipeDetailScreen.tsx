import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipeDetail, rateRecipe } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PopOnChange } from "../components/PopOnChange";
import { ShareableRecipeCard } from "../components/ShareableRecipeCard";
import { StarRating } from "../components/StarRating";
import { useLocale } from "../i18n/LocaleContext";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useMealPlan } from "../context/MealPlanContext";
import { useUnits } from "../context/UnitsContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { useNotes } from "../context/NotesContext";
import { formatQuantity } from "../utils/units";
import { intersectAllergens } from "../utils/allergens";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { DietGoal, RecipeDetail } from "../api/types";

const BODY_GOALS: DietGoal[] = ["LOSE_WEIGHT", "BUILD_MUSCLE", "GAIN_WEIGHT"];
const SERVINGS_PRESETS = [2, 4, 6, 8];
const MEAL_PLAN_DAYS_AHEAD = 7;

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dateKeyFor(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { unitSystem } = useUnits();
  const { isAuthenticated, user } = useAuth();
  const { preference: localPreference } = useLocalPreference();
  const { addRecent } = useRecentlyViewed();
  const { plan, setPlan } = useMealPlan();
  const { getNote, setNote } = useNotes();
  const [noteText, setNoteText] = useState("");
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(1);
  const [sharing, setSharing] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [rating, setRating] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const shareCardRef = useRef<View>(null);

  const myGoal = isAuthenticated ? user?.preference?.dietGoal ?? "NONE" : localPreference.dietGoal;
  const hasBodyGoal = BODY_GOALS.includes(myGoal);
  const [wantsAdapted, setWantsAdapted] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRecipeDetail(slug, hasBodyGoal && wantsAdapted ? myGoal : undefined)
      .then((data) => {
        setRecipe(data);
        setServings((prev) => (prev === 1 ? data.baseServings : prev));
        setMyRating(data.myRating);
        addRecent(data);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locale, hasBodyGoal, wantsAdapted, myGoal]);

  useEffect(() => {
    setNoteText(getNote(slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
  const conflictingAllergens = intersectAllergens(recipe.allergens, user?.preference?.allergies ?? []);

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
      const trimmedComment = reviewText.trim();
      const result = await rateRecipe(recipe.slug, score, trimmedComment || undefined);
      setRecipe((prev) => {
        if (!prev) return prev;
        const others = prev.reviews.filter((r) => r.name !== user?.name);
        const reviews = trimmedComment ? [{ name: user?.name ?? "", score, comment: trimmedComment }, ...others] : others;
        return { ...prev, avgRating: result.average, ratingCount: result.count, reviews };
      });
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

          {conflictingAllergens.length > 0 ? (
            <View style={styles.allergenBanner}>
              <Text style={[styles.allergenBannerText, { textAlign }]}>
                {t("recipeDetail.allergenWarning", {
                  allergens: conflictingAllergens.map((a) => t(`allergen.${a}` as TranslationKey)).join(", "),
                })}
              </Text>
            </View>
          ) : null}

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
            <MetaPill
              label={t("recipeCard.costPerServing", { cost: Math.round(recipe.costPerServing) })}
              styles={styles}
            />
          </View>

          {hasBodyGoal ? (
            <View style={styles.adaptRow}>
              <Text style={[styles.sectionTitle, styles.adaptTitle, { textAlign }]}>
                {t("recipeDetail.adaptSectionTitle")}
              </Text>
              <View style={styles.chipRow}>
                <Chip label={t("recipeDetail.adaptOriginal")} selected={!wantsAdapted} onPress={() => setWantsAdapted(false)} />
                <Chip label={t("recipeDetail.adaptAdapted")} selected={wantsAdapted} onPress={() => setWantsAdapted(true)} />
              </View>
            </View>
          ) : null}

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
          <View style={styles.servingsPresetRow}>
            {SERVINGS_PRESETS.map((preset) => (
              <Chip key={preset} label={String(preset)} selected={servings === preset} onPress={() => setServings(preset)} />
            ))}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("recipeDetail.ingredientsFor", { count: servings })}
          </Text>
          {scaledIngredients.map((ing, i) => {
            const ingredientConflicts = intersectAllergens(ing.allergens, user?.preference?.allergies ?? []);
            return (
            <FadeSlideIn key={ing.name} index={i}>
              <View style={styles.ingredientCell}>
                <View style={styles.ingredientRow}>
                  <Text style={[styles.ingredientName, ingredientConflicts.length > 0 && styles.ingredientNameWarning]}>
                    {ing.name}
                  </Text>
                  <Text style={styles.ingredientQty}>{formatQuantity(ing.quantity, ing.unit, unitSystem)}</Text>
                </View>
                {ingredientConflicts.length > 0 ? (
                  <Text style={[styles.ingredientAllergenNote, { textAlign }]}>
                    {ingredientConflicts.map((a) => t(`allergen.${a}` as TranslationKey)).join(", ")}
                  </Text>
                ) : null}
                {ing.substitutedFrom ? (
                  <Text style={[styles.ingredientAdaptedNote, { textAlign }]}>
                    {t("recipeDetail.substitutedFrom", { original: ing.substitutedFrom })}
                  </Text>
                ) : null}
                {ing.substitute ? (
                  <Text style={[styles.ingredientSubstitute, { textAlign }]}>
                    {t("recipeDetail.substituteHint", { substitute: ing.substitute })}
                  </Text>
                ) : null}
              </View>
            </FadeSlideIn>
            );
          })}

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

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.addToMealPlan")}</Text>
          <View style={styles.mealPlanDayRow}>
            {Array.from({ length: MEAL_PLAN_DAYS_AHEAD }, (_, offset) => {
              const dateKey = dateKeyFor(offset);
              const isPlanned = plan[dateKey]?.slug === recipe.slug;
              const label =
                offset === 0
                  ? t("mealPlanner.today")
                  : offset === 1
                    ? t("mealPlanner.tomorrow")
                    : t(`weekday.${new Date(dateKey + "T00:00:00").getDay()}` as TranslationKey);
              return (
                <Chip
                  key={dateKey}
                  label={isPlanned ? `✓ ${label}` : label}
                  selected={isPlanned}
                  onPress={() => setPlan(dateKey, isPlanned ? null : recipe)}
                />
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.rateThis")}</Text>
          {isAuthenticated ? (
            <>
              <TextInput
                style={[styles.notesInput, { textAlign }]}
                placeholder={t("recipeDetail.reviewPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
              />
              <View style={styles.rateRow}>
                <StarRating value={myRating ?? 0} onChange={handleRate} size={30} />
                {rating ? <ActivityIndicator size="small" color={colors.primary} style={styles.rateSpinner} /> : null}
              </View>
            </>
          ) : (
            <Text style={[styles.rateLoginHint, { textAlign }]}>{t("recipeDetail.rateLoginHint")}</Text>
          )}

          {recipe.reviews.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.reviews")}</Text>
              {recipe.reviews.map((review, i) => (
                <FadeSlideIn key={`${review.name}-${i}`} index={i}>
                  <View style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewName}>{review.name}</Text>
                      <StarRating value={review.score} size={12} />
                    </View>
                    <Text style={[styles.reviewComment, { textAlign }]}>{review.comment}</Text>
                  </View>
                </FadeSlideIn>
              ))}
            </>
          ) : null}

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.myNotes")}</Text>
          <TextInput
            style={[styles.notesInput, { textAlign }]}
            placeholder={t("recipeDetail.myNotesPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={noteText}
            onChangeText={setNoteText}
            onBlur={() => setNote(slug, noteText)}
            multiline
          />
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
              slug: recipe.slug,
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
  allergenBanner: {
    backgroundColor: colors.danger + "22",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginTop: spacing(1.5),
  },
  allergenBannerText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  avgRatingRow: { flexDirection: "row", alignItems: "center", marginTop: spacing(1) },
  avgRatingText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginStart: spacing(1) },
  rateRow: { flexDirection: "row", alignItems: "center" },
  rateSpinner: { marginStart: spacing(1.5) },
  rateLoginHint: { color: colors.textMuted, fontSize: 13 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1),
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewName: { fontSize: 13, fontWeight: "700", color: colors.text },
  reviewComment: { fontSize: 13, color: colors.textMuted, marginTop: spacing(0.75), lineHeight: 18 },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.5),
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
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
  ingredientNameWarning: { color: colors.danger, fontWeight: "700" },
  ingredientAllergenNote: { color: colors.danger, fontSize: 11, fontWeight: "700", marginTop: 2 },
  ingredientQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  ingredientSubstitute: { color: colors.primaryDark, fontSize: 12, marginTop: 2 },
  ingredientAdaptedNote: { color: colors.secondary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  adaptRow: { marginTop: spacing(1) },
  adaptTitle: { marginBottom: spacing(1) },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  mealPlanDayRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing(1) },
  stepperRow: { flexDirection: "row", alignItems: "center" },
  servingsPresetRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", marginTop: spacing(1.5) },
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
