import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisines, fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { useMealPlan } from "../context/MealPlanContext";
import { useToast } from "../context/ToastContext";
import {
  ACTIVITY_LEVELS,
  KCAL_PER_KG_FAT,
  MEAL_SLOTS,
  buildMealPrepPlan,
  dailyTargetCalories,
  maintenanceCalories,
  type ActivityLevel,
  type MealPrepPlan,
  type MealSlot,
  type Sex,
} from "../utils/mealPrep";
import { intersectAllergens, useMyAllergies } from "../utils/allergens";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";
import type { Cuisine } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "MealPrep">;

const DAYS = 7;
const SETTINGS_KEY = "cookmate.mealPrep.settings";
const PLAN_KEY = "cookmate.mealPrep.plan";
const FALLBACK_MAINTENANCE = 2000;

type Settings = {
  lovedCuisineSlugs: string[];
  budget: string;
  deficit: boolean;
  sex: Sex;
  age: string;
  height: string;
  weight: string;
  activity: ActivityLevel;
  freeDayIndex: number | null;
  cheatDayIndex: number | null;
  cheatSlot: MealSlot;
};

type SavedPlan = { startDateKey: string; dailyTarget: number; weeklyBudget: number | null; plan: MealPrepPlan; seed: number };

const DEFAULT_SETTINGS: Settings = {
  lovedCuisineSlugs: [],
  budget: "",
  deficit: true,
  sex: "female",
  age: "",
  height: "",
  weight: "",
  activity: "light",
  freeDayIndex: null,
  cheatDayIndex: null,
  cheatSlot: "dinner",
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseInRange(value: string, min: number, max: number): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function MealPrepScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";
  const { user } = useAuth();
  const { favoriteRecipes } = useFavorites();
  const { setPlan } = useMealPlan();
  const { showToast } = useToast();
  const myAllergies = useMyAllergies();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCuisines().then(setCuisines).catch(() => {});
    (async () => {
      try {
        const [storedSettings, storedPlan] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PLAN_KEY),
        ]);
        if (storedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
        } else if (user?.preference?.favoriteCuisineSlugs.length) {
          setSettings((s) => ({ ...s, lovedCuisineSlugs: user.preference!.favoriteCuisineSlugs }));
        }
        if (storedPlan) setSaved(JSON.parse(storedPlan));
      } finally {
        setSettingsLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settingsLoaded) AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, settingsLoaded]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  const age = parseInRange(settings.age, 15, 90);
  const height = parseInRange(settings.height, 120, 230);
  const weight = parseInRange(settings.weight, 35, 250);
  const hasBodyStats = age != null && height != null && weight != null;
  const maintenance = hasBodyStats
    ? maintenanceCalories({ sex: settings.sex, age, heightCm: height, weightKg: weight, activity: settings.activity })
    : FALLBACK_MAINTENANCE;
  const dailyTarget = dailyTargetCalories(maintenance, settings.sex, settings.deficit);
  const weeklyBudget = parseInRange(settings.budget, 1, 1_000_000);

  const dayLabel = (startDateKey: string, index: number) => {
    const dateKey = addDays(startDateKey, index);
    const today = todayKey();
    if (dateKey === today) return t("mealPlanner.today");
    if (dateKey === addDays(today, 1)) return t("mealPlanner.tomorrow");
    return t(`weekday.${new Date(dateKey + "T00:00:00Z").getUTCDay()}` as TranslationKey);
  };

  const toggleCuisine = (slug: string) =>
    update({
      lovedCuisineSlugs: settings.lovedCuisineSlugs.includes(slug)
        ? settings.lovedCuisineSlugs.filter((s) => s !== slug)
        : [...settings.lovedCuisineSlugs, slug],
    });

  const setFreeDay = (index: number | null) =>
    update({ freeDayIndex: index, cheatDayIndex: settings.cheatDayIndex === index ? null : settings.cheatDayIndex });

  const generate = async (seed: number) => {
    setGenerating(true);
    setFailed(false);
    try {
      const all = await fetchRecipes({});
      const safe =
        myAllergies.length > 0 ? all.filter((r) => intersectAllergens(r.allergens, myAllergies).length === 0) : all;
      const plan = buildMealPrepPlan(safe, {
        days: DAYS,
        maintenance,
        dailyTarget,
        deficit: settings.deficit,
        lovedCuisineSlugs: settings.lovedCuisineSlugs,
        favoriteSlugs: favoriteRecipes.map((r) => r.slug),
        weeklyBudget,
        freeDayIndex: settings.freeDayIndex,
        cheat:
          settings.cheatDayIndex != null ? { dayIndex: settings.cheatDayIndex, slot: settings.cheatSlot } : null,
        seed,
      });
      if (!plan) {
        setFailed(true);
        return;
      }
      const next: SavedPlan = { startDateKey: todayKey(), dailyTarget, weeklyBudget, plan, seed };
      setSaved(next);
      AsyncStorage.setItem(PLAN_KEY, JSON.stringify(next)).catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setGenerating(false);
    }
  };

  const addDinnersToPlanner = () => {
    if (!saved) return;
    for (const day of saved.plan.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner");
      if (dinner) setPlan(addDays(saved.startDateKey, day.index), dinner.recipe);
    }
    showToast(t("mealPrep.addedToast"));
  };

  const plan = saved?.plan;
  const weeklyKg = plan ? plan.weeklyDeficit / KCAL_PER_KG_FAT : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🥡</Text>
        <Text style={[styles.title, { textAlign }]}>{t("mealPrep.title")}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("mealPrep.subtitle")}</Text>

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.lovedTitle")}</Text>
        <Text style={[styles.hint, { textAlign }]}>{t("mealPrep.lovedHint")}</Text>
        <View style={styles.chipRow}>
          {cuisines.map((c) => (
            <Chip
              key={c.slug}
              label={`${CUISINE_EMOJI[c.slug] ?? "🍽️"} ${c.name}`}
              selected={settings.lovedCuisineSlugs.includes(c.slug)}
              onPress={() => toggleCuisine(c.slug)}
            />
          ))}
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.budgetTitle")}</Text>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("mealPrep.budgetPlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={settings.budget}
          onChangeText={(budget) => update({ budget })}
        />

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.goalTitle")}</Text>
        <View style={styles.chipRow}>
          <Chip label={t("mealPrep.goalMaintain")} selected={!settings.deficit} onPress={() => update({ deficit: false })} />
          <Chip label={t("mealPrep.goalDeficit")} selected={settings.deficit} onPress={() => update({ deficit: true })} />
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.aboutYou")}</Text>
        <View style={styles.chipRow}>
          <Chip label={t("mealPrep.sexFemale")} selected={settings.sex === "female"} onPress={() => update({ sex: "female" })} />
          <Chip label={t("mealPrep.sexMale")} selected={settings.sex === "male"} onPress={() => update({ sex: "male" })} />
        </View>
        <View style={styles.bodyRow}>
          {(
            [
              ["age", "mealPrep.age"],
              ["height", "mealPrep.height"],
              ["weight", "mealPrep.weight"],
            ] as const
          ).map(([field, labelKey]) => (
            <View key={field} style={styles.bodyField}>
              <Text style={styles.bodyLabel}>{t(labelKey)}</Text>
              <TextInput
                style={[styles.input, styles.bodyInput]}
                keyboardType="decimal-pad"
                value={settings[field]}
                onChangeText={(value) => update({ [field]: value })}
                accessibilityLabel={t(labelKey)}
              />
            </View>
          ))}
        </View>
        <View style={styles.chipRow}>
          {ACTIVITY_LEVELS.map((level) => (
            <Chip
              key={level}
              label={t(`mealPrep.activity.${level}` as TranslationKey)}
              selected={settings.activity === level}
              onPress={() => update({ activity: level })}
            />
          ))}
        </View>
        <View style={styles.targetBox}>
          <Text style={[styles.targetText, { textAlign }]}>
            {hasBodyStats
              ? t("mealPrep.targetLine", { maintenance, target: dailyTarget })
              : t("mealPrep.targetFallback", { target: dailyTarget })}
          </Text>
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.freeDayTitle")}</Text>
        <Text style={[styles.hint, { textAlign }]}>{t("mealPrep.freeDayHint")}</Text>
        <View style={styles.chipRow}>
          <Chip label={t("mealPrep.none")} selected={settings.freeDayIndex == null} onPress={() => setFreeDay(null)} />
          {Array.from({ length: DAYS }, (_, i) => (
            <Chip
              key={i}
              label={dayLabel(todayKey(), i)}
              selected={settings.freeDayIndex === i}
              onPress={() => setFreeDay(i)}
            />
          ))}
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.cheatTitle")}</Text>
        <Text style={[styles.hint, { textAlign }]}>{t("mealPrep.cheatHint")}</Text>
        <View style={styles.chipRow}>
          <Chip
            label={t("mealPrep.none")}
            selected={settings.cheatDayIndex == null}
            onPress={() => update({ cheatDayIndex: null })}
          />
          {Array.from({ length: DAYS }, (_, i) => i)
            .filter((i) => i !== settings.freeDayIndex)
            .map((i) => (
              <Chip
                key={i}
                label={dayLabel(todayKey(), i)}
                selected={settings.cheatDayIndex === i}
                onPress={() => update({ cheatDayIndex: i })}
              />
            ))}
        </View>
        {settings.cheatDayIndex != null ? (
          <View style={styles.chipRow}>
            {MEAL_SLOTS.map((slot) => (
              <Chip
                key={slot}
                label={t(`mealPrep.slot.${slot}` as TranslationKey)}
                selected={settings.cheatSlot === slot}
                onPress={() => update({ cheatSlot: slot })}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.fullWidth}>
          <PrimaryButton label={t("mealPrep.generate")} onPress={() => generate(0)} loading={generating} />
        </View>
        {failed ? <Text style={[styles.errorText, { textAlign }]}>{t("mealPrep.noRecipes")}</Text> : null}

        {saved && plan ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{plan.avgDailyCalories}</Text>
                <Text style={styles.statLabel}>{t("mealPrep.statAvgCalories", { target: saved.dailyTarget })}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statValue, plan.withinBudget === false && styles.overBudget]}>
                  {Math.round(plan.weeklyCost)}
                </Text>
                <Text style={styles.statLabel}>{t("mealPrep.statWeeklyCost")}</Text>
              </View>
              {weeklyKg > 0.05 ? (
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>−{weeklyKg.toFixed(1)} kg</Text>
                  <Text style={styles.statLabel}>{t("mealPrep.statWeeklyChange")}</Text>
                </View>
              ) : null}
            </View>
            {saved.weeklyBudget != null ? (
              <Text style={[styles.budgetNote, plan.withinBudget ? styles.withinBudget : styles.overBudget, { textAlign }]}>
                {plan.withinBudget
                  ? t("mealPrep.withinBudget", { budget: saved.weeklyBudget })
                  : t("mealPrep.overBudget", {
                      budget: saved.weeklyBudget,
                      amount: Math.round(plan.weeklyCost - saved.weeklyBudget),
                    })}
              </Text>
            ) : null}

            {plan.days.map((day, i) => (
              <FadeSlideIn key={day.index} index={i} style={styles.fullWidth}>
                <View style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{dayLabel(saved.startDateKey, day.index)}</Text>
                    {!day.isFree ? (
                      <Text style={styles.dayTotals}>
                        {t("mealPrep.dayTotals", { calories: day.calories, target: saved.dailyTarget, cost: Math.round(day.cost) })}
                      </Text>
                    ) : null}
                  </View>
                  {day.isFree ? (
                    <Text style={[styles.freeDayText, { textAlign }]}>{t("mealPrep.freeDayCard")}</Text>
                  ) : (
                    day.meals.map((meal) => (
                      <AnimatedPressable
                        key={meal.slot}
                        style={styles.mealRow}
                        pressScale={0.98}
                        onPress={() => navigation.navigate("RecipeDetail", { slug: meal.recipe.slug })}
                      >
                        <Text style={styles.mealEmoji}>{CUISINE_EMOJI[meal.recipe.cuisine.slug] ?? "🍽️"}</Text>
                        <View style={styles.mealTextCol}>
                          <Text style={styles.mealSlot}>
                            {t(`mealPrep.slot.${meal.slot}` as TranslationKey)}
                            {meal.isCheat ? `  ${t("mealPrep.cheatBadge")}` : ""}
                          </Text>
                          <Text style={styles.mealTitle} numberOfLines={1}>
                            {meal.recipe.title}
                          </Text>
                          <Text style={styles.mealMeta}>
                            {t("mealPrep.mealLine", {
                              portions: meal.portions,
                              calories: meal.calories,
                              cost: Math.round(meal.cost),
                            })}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    ))
                  )}
                </View>
              </FadeSlideIn>
            ))}

            <View style={styles.prepCard}>
              <Text style={[styles.prepTitle, { textAlign }]}>{t("mealPrep.prepTitle")}</Text>
              {plan.prepList.map((item) => (
                <View key={item.recipe.slug} style={styles.prepRow}>
                  <Text style={styles.prepName} numberOfLines={1}>
                    {item.recipe.title}
                  </Text>
                  <Text style={styles.prepPortions}>{t("mealPrep.prepLine", { portions: item.portions })}</Text>
                </View>
              ))}
            </View>

            <View style={styles.fullWidth}>
              <PrimaryButton
                label={t("mealPrep.regenerate")}
                variant="outline"
                onPress={() => generate(saved.seed + 1)}
                loading={generating}
              />
            </View>
            <View style={styles.fullWidth}>
              <PrimaryButton label={t("mealPrep.addDinners")} variant="outline" onPress={addDinnersToPlanner} />
            </View>
            <Text style={[styles.disclaimer, { textAlign }]}>{t("mealPrep.disclaimer")}</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6), alignItems: "center" },
    fullWidth: { width: "100%", marginTop: spacing(1.5) },
    emoji: { fontSize: 48, marginBottom: spacing(1) },
    title: { fontSize: 22, fontWeight: "800", color: colors.text, width: "100%" },
    subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing(1), lineHeight: 20, width: "100%" },
    label: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing(2.5), width: "100%" },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: 2, width: "100%" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", width: "100%", marginTop: spacing(1) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
      width: "100%",
      marginTop: spacing(1),
    },
    bodyRow: { flexDirection: "row", width: "100%", gap: spacing(1), marginTop: spacing(0.5) },
    bodyField: { flex: 1 },
    bodyLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginTop: spacing(1) },
    bodyInput: { marginTop: spacing(0.5), textAlign: "center" },
    targetBox: {
      width: "100%",
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(1.5),
      marginTop: spacing(1.5),
    },
    targetText: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
    errorText: { fontSize: 13, color: colors.danger, marginTop: spacing(1), width: "100%" },
    statsRow: {
      flexDirection: "row",
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: spacing(1.5),
      marginTop: spacing(3),
      ...shadow.card,
    },
    statTile: { flex: 1, alignItems: "center", paddingHorizontal: spacing(0.5) },
    statValue: { fontSize: 17, fontWeight: "800", color: colors.text },
    statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    budgetNote: { fontSize: 12, fontWeight: "600", marginTop: spacing(1), width: "100%" },
    withinBudget: { color: colors.success },
    overBudget: { color: colors.danger },
    dayCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
    },
    dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing(1) },
    dayTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
    dayTotals: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
    freeDayText: { fontSize: 13, color: colors.textMuted },
    mealRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing(0.75) },
    mealEmoji: { fontSize: 22, marginEnd: spacing(1.25) },
    mealTextCol: { flex: 1 },
    mealSlot: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    mealTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 1 },
    mealMeta: { fontSize: 11, fontWeight: "600", color: colors.primaryDark, marginTop: 1 },
    prepCard: {
      width: "100%",
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(1.5),
      marginTop: spacing(2.5),
    },
    prepTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: spacing(1) },
    prepRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing(0.5) },
    prepName: { flex: 1, fontSize: 13, color: colors.text, marginEnd: spacing(1) },
    prepPortions: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
    disclaimer: { fontSize: 11, color: colors.textMuted, marginTop: spacing(2), width: "100%", lineHeight: 16 },
  });
