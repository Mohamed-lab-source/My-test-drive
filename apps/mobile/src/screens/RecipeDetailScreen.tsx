import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipeDetail } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { colors, radius, spacing } from "../theme";
import type { RecipeDetail } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { t, locale, isRTL } = useLocale();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetchRecipeDetail(slug)
      .then((data) => {
        setRecipe(data);
        setServings((prev) => (prev === 1 ? data.baseServings : prev));
      })
      .finally(() => setLoading(false));
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

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { textAlign }]}>{recipe.title}</Text>
          <Text style={[styles.description, { textAlign }]}>{recipe.description}</Text>

          <View style={styles.metaRow}>
            <MetaPill label={`${recipe.cuisine.name}`} />
            <MetaPill label={recipe.dishType} />
            <MetaPill label={`${totalMinutes} ${t("recipeDetail.min")}`} />
            <MetaPill label={recipe.difficulty} />
            <MetaPill label={t("recipeDetail.serves", { count: recipe.baseServings })} />
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.nutrition")}</Text>
          <View style={styles.nutritionRow}>
            <NutritionStat
              label={t("recipeDetail.calories")}
              value={`${recipe.nutritionPerServing.calories}`}
              unit={t("recipeDetail.kcal")}
            />
            <NutritionStat
              label={t("recipeDetail.protein")}
              value={`${recipe.nutritionPerServing.proteinGrams}`}
              unit={t("recipeDetail.gramsUnit")}
            />
            <NutritionStat
              label={t("recipeDetail.fat")}
              value={`${recipe.nutritionPerServing.fatGrams}`}
              unit={t("recipeDetail.gramsUnit")}
            />
            <NutritionStat
              label={t("recipeDetail.carbs")}
              value={`${recipe.nutritionPerServing.carbsGrams}`}
              unit={t("recipeDetail.gramsUnit")}
            />
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.servingsQuestion")}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              accessibilityRole="button"
              accessibilityLabel={t("recipeDetail.fewerPeople")}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{servings}</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setServings((s) => Math.min(50, s + 1))}
              accessibilityRole="button"
              accessibilityLabel={t("recipeDetail.morePeople")}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("recipeDetail.ingredientsFor", { count: servings })}
          </Text>
          {scaledIngredients.map((ing) => (
            <View key={ing.name} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipeDetail.steps")}</Text>
          {recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepCard}>
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
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={t("recipeDetail.planShoppingList")}
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
    </SafeAreaView>
  );
}

function NutritionStat({ label, value, unit }: { label: string; value: string; unit: string }) {
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

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  description: { color: colors.textMuted, marginTop: spacing(1), lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing(2) },
  metaPill: {
    backgroundColor: colors.chipBackground,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 6,
    marginRight: spacing(1),
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
    marginRight: spacing(1),
  },
  nutritionValue: { fontSize: 16, fontWeight: "800", color: colors.primaryDark },
  nutritionUnit: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  nutritionLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ingredientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientName: { color: colors.text, fontSize: 14 },
  ingredientQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
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
});
