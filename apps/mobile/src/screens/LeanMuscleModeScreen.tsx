import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { useMealPlan } from "../context/MealPlanContext";
import { pickLeanMuscleWeek, LEAN_MUSCLE_TARGETS } from "../utils/leanMuscle";
import { intersectAllergens } from "../utils/allergens";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "LeanMuscleMode">;

const DAYS_AHEAD = 7;

function dateKeyFor(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function LeanMuscleModeScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { plan, setPlan } = useMealPlan();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [generating, setGenerating] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  const visibleDateKeys = Array.from({ length: DAYS_AHEAD }, (_, offset) => dateKeyFor(offset));
  const weekPlan = visibleDateKeys.map((dateKey) => plan[dateKey]);
  const hasWeek = weekPlan.every(Boolean);

  const weekdayLabel = (offset: number, dateKey: string) => {
    if (offset === 0) return t("mealPlanner.today");
    if (offset === 1) return t("mealPlanner.tomorrow");
    const day = new Date(dateKey + "T00:00:00").getDay();
    return t(`weekday.${day}` as TranslationKey);
  };

  const weeklyAverages = hasWeek
    ? {
        avgProtein:
          Math.round((weekPlan.reduce((sum, r) => sum + (r?.proteinPerServing ?? 0), 0) / DAYS_AHEAD) * 10) / 10,
        avgFat: Math.round((weekPlan.reduce((sum, r) => sum + (r?.fatPerServing ?? 0), 0) / DAYS_AHEAD) * 10) / 10,
        avgCalories: Math.round(weekPlan.reduce((sum, r) => sum + (r?.caloriesPerServing ?? 0), 0) / DAYS_AHEAD),
      }
    : null;

  const generateWeek = async () => {
    setGenerating(true);
    try {
      const allRecipes = await fetchRecipes({});
      const myAllergies = user?.preference?.allergies ?? [];
      const safeRecipes =
        myAllergies.length > 0
          ? allRecipes.filter((r) => intersectAllergens(r.allergens, myAllergies).length === 0)
          : allRecipes;
      const picks = pickLeanMuscleWeek(safeRecipes, DAYS_AHEAD);
      visibleDateKeys.forEach((dateKey, i) => {
        if (picks[i]) setPlan(dateKey, picks[i]);
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>💪</Text>
        <Text style={[styles.title, { textAlign }]}>{t("leanMuscle.title")}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("leanMuscle.subtitle")}</Text>

        <View style={styles.targetsRow}>
          <View style={styles.targetTile}>
            <Text style={styles.targetValue}>{LEAN_MUSCLE_TARGETS.minProtein}g+</Text>
            <Text style={styles.targetLabel}>{t("leanMuscle.targetProtein")}</Text>
          </View>
          <View style={styles.targetTile}>
            <Text style={styles.targetValue}>{LEAN_MUSCLE_TARGETS.maxFat}g-</Text>
            <Text style={styles.targetLabel}>{t("leanMuscle.targetFat")}</Text>
          </View>
          <View style={styles.targetTile}>
            <Text style={styles.targetValue}>{LEAN_MUSCLE_TARGETS.maxMinutes}m</Text>
            <Text style={styles.targetLabel}>{t("leanMuscle.targetTime")}</Text>
          </View>
        </View>

        <View style={styles.generateButton}>
          <PrimaryButton
            label={hasWeek ? t("leanMuscle.regenerate") : t("leanMuscle.fillWeek")}
            onPress={generateWeek}
            loading={generating}
          />
        </View>
        {hasWeek ? (
          <Text style={[styles.overwriteHint, { textAlign }]}>{t("leanMuscle.overwriteHint")}</Text>
        ) : null}

        {weeklyAverages ? (
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{weeklyAverages.avgProtein}g</Text>
              <Text style={styles.statLabel}>{t("leanMuscle.avgProtein")}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{weeklyAverages.avgFat}g</Text>
              <Text style={styles.statLabel}>{t("leanMuscle.avgFat")}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{weeklyAverages.avgCalories}</Text>
              <Text style={styles.statLabel}>{t("leanMuscle.avgCalories")}</Text>
            </View>
          </View>
        ) : null}

        {hasWeek ? (
          <>
            <Text style={[styles.sectionTitle, { textAlign }]}>{t("leanMuscle.yourWeek")}</Text>
            {visibleDateKeys.map((dateKey, i) => {
              const recipe = weekPlan[i];
              if (!recipe) return null;
              return (
                <FadeSlideIn key={dateKey} index={i}>
                  <AnimatedPressable
                    style={styles.dayRow}
                    pressScale={0.98}
                    onPress={() => navigation.navigate("RecipeDetail", { slug: recipe.slug })}
                  >
                    <Text style={styles.dayEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
                    <View style={styles.dayTextCol}>
                      <Text style={styles.dayLabel}>{weekdayLabel(i, dateKey)}</Text>
                      <Text style={styles.dayTitle} numberOfLines={1}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.dayMacros}>
                        {t("leanMuscle.macroLine", {
                          protein: recipe.proteinPerServing,
                          fat: recipe.fatPerServing,
                          calories: recipe.caloriesPerServing,
                        })}
                      </Text>
                    </View>
                  </AnimatedPressable>
                </FadeSlideIn>
              );
            })}
          </>
        ) : null}

        <View style={styles.plannerButton}>
          <PrimaryButton
            label={t("leanMuscle.openPlanner")}
            variant="outline"
            onPress={() => navigation.navigate("MealPlanner")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6), alignItems: "center" },
    emoji: { fontSize: 48, marginBottom: spacing(1) },
    title: { fontSize: 22, fontWeight: "800", color: colors.text, width: "100%" },
    subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing(1), lineHeight: 20, width: "100%" },
    targetsRow: {
      flexDirection: "row",
      width: "100%",
      backgroundColor: colors.chipBackground,
      borderRadius: 14,
      paddingVertical: spacing(1.5),
      marginTop: spacing(2.5),
    },
    targetTile: { flex: 1, alignItems: "center" },
    targetValue: { fontSize: 17, fontWeight: "800", color: colors.primaryDark },
    targetLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    generateButton: { width: "100%", marginTop: spacing(3) },
    overwriteHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing(1), width: "100%" },
    statsRow: {
      flexDirection: "row",
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: spacing(1.5),
      marginTop: spacing(2.5),
      ...shadow.card,
    },
    statTile: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 16, fontWeight: "800", color: colors.text },
    statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginTop: spacing(3),
      marginBottom: spacing(1.5),
      width: "100%",
    },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginBottom: spacing(1.25),
    },
    dayEmoji: { fontSize: 26, marginEnd: spacing(1.5) },
    dayTextCol: { flex: 1 },
    dayLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    dayTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
    dayMacros: { fontSize: 11, color: colors.primaryDark, fontWeight: "600", marginTop: 2 },
    plannerButton: { width: "100%", marginTop: spacing(2) },
  });
