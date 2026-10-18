import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Share, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisines, fetchRecipeDetail, fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { useMealPlan } from "../context/MealPlanContext";
import { useToast } from "../context/ToastContext";
import { useUnits } from "../context/UnitsContext";
import {
  ACTIVITY_LEVELS,
  KCAL_PER_KG_FAT,
  aggregatePrepIngredients,
  buildMealPrepPlan,
  dailyTargetCalories,
  maintenanceCalories,
  mealKey,
  slotsFor,
  suggestSwap,
  type ActivityLevel,
  type AggregatedIngredient,
  type MealPrepOptions,
  type MealPrepPlan,
  type MealSlot,
  type PlannedMeal,
  type Sex,
} from "../utils/mealPrep";
import { intersectAllergens, useMyAllergies } from "../utils/allergens";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { categoryEmoji, categoryLabelKey, groupByCategory } from "../utils/ingredientCategory";
import { formatQuantity } from "../utils/units";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";
import type { Cuisine, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "MealPrep">;

const DAYS = 7;
const SETTINGS_KEY = "cookmate.mealPrep.settings";
const PLAN_KEY = "cookmate.mealPrep.plan";
const WEIGHT_LOG_KEY = "cookmate.weightLog";
const FALLBACK_MAINTENANCE = 2000;
const WEIGHT_LOG_SHOWN = 8;

type Settings = {
  lovedCuisineSlugs: string[];
  budget: string;
  deficit: boolean;
  sex: Sex;
  age: string;
  height: string;
  weight: string;
  activity: ActivityLevel;
  mealsPerDay: 2 | 3;
  includeSnack: boolean;
  excludedSlugs: string[];
  freeDayIndex: number | null;
  cheatDayIndex: number | null;
  cheatSlot: MealSlot;
};

type SavedPlan = {
  startDateKey: string;
  dailyTarget: number;
  weeklyBudget: number | null;
  plan: MealPrepPlan;
  seed: number;
  pinned: Record<string, string>;
  swapNonce: number;
};

type WeightEntry = { date: string; kg: number };

const DEFAULT_SETTINGS: Settings = {
  lovedCuisineSlugs: [],
  budget: "",
  deficit: true,
  sex: "female",
  age: "",
  height: "",
  weight: "",
  activity: "light",
  mealsPerDay: 3,
  includeSnack: false,
  excludedSlugs: [],
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

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(d)}/${Number(m)}`;
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
  const { unitSystem } = useUnits();
  const myAllergies = useMyAllergies();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shoppingList, setShoppingList] = useState<AggregatedIngredient[] | null>(null);
  const [loadingShopping, setLoadingShopping] = useState(false);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    fetchCuisines().then(setCuisines).catch(() => {});
    (async () => {
      try {
        const [storedSettings, storedPlan, storedWeights] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PLAN_KEY),
          AsyncStorage.getItem(WEIGHT_LOG_KEY),
        ]);
        if (storedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
        } else if (user?.preference?.favoriteCuisineSlugs.length) {
          setSettings((s) => ({ ...s, lovedCuisineSlugs: user.preference!.favoriteCuisineSlugs }));
        }
        if (storedPlan) {
          const parsed = JSON.parse(storedPlan);
          // Plans saved before pinning existed lack these fields.
          setSaved({ pinned: {}, swapNonce: 0, ...parsed });
        }
        if (storedWeights) setWeightLog(JSON.parse(storedWeights));
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
  const slots = slotsFor(settings.mealsPerDay, settings.includeSnack);

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

  const setMealsPerDay = (mealsPerDay: 2 | 3) => {
    const nextSlots = slotsFor(mealsPerDay, settings.includeSnack);
    update({ mealsPerDay, cheatSlot: nextSlots.includes(settings.cheatSlot) ? settings.cheatSlot : "dinner" });
  };

  const setIncludeSnack = (includeSnack: boolean) =>
    update({ includeSnack, cheatSlot: !includeSnack && settings.cheatSlot === "snack" ? "dinner" : settings.cheatSlot });

  const loadRecipes = async (): Promise<RecipeSummary[]> => {
    if (recipes) return recipes;
    const all = await fetchRecipes({});
    const safe =
      myAllergies.length > 0 ? all.filter((r) => intersectAllergens(r.allergens, myAllergies).length === 0) : all;
    setRecipes(safe);
    return safe;
  };

  const optionsFor = (s: Settings, seed: number, pinned: Record<string, string>): MealPrepOptions => ({
    days: DAYS,
    maintenance,
    dailyTarget,
    deficit: s.deficit,
    mealsPerDay: s.mealsPerDay,
    includeSnack: s.includeSnack,
    lovedCuisineSlugs: s.lovedCuisineSlugs,
    favoriteSlugs: favoriteRecipes.map((r) => r.slug),
    excludedSlugs: s.excludedSlugs,
    pinned,
    weeklyBudget,
    freeDayIndex: s.freeDayIndex,
    cheat: s.cheatDayIndex != null ? { dayIndex: s.cheatDayIndex, slot: s.cheatSlot } : null,
    seed,
  });

  /**
   * Rebuilds from cached recipes so lock/swap/exclude feel instant. Pins are
   * keyed by day index, so they're dropped if the week now starts on a
   * different date than when they were set.
   */
  const rebuild = async (opts: { seed: number; pinned: Record<string, string>; swapNonce?: number; s?: Settings }) => {
    setGenerating(true);
    setFailed(false);
    try {
      const all = await loadRecipes();
      const startDateKey = todayKey();
      const pinned = saved && saved.startDateKey !== startDateKey ? {} : opts.pinned;
      const plan = buildMealPrepPlan(all, optionsFor(opts.s ?? settings, opts.seed, pinned));
      if (!plan) {
        setFailed(true);
        return;
      }
      const next: SavedPlan = {
        startDateKey,
        dailyTarget,
        weeklyBudget,
        plan,
        seed: opts.seed,
        pinned,
        swapNonce: opts.swapNonce ?? saved?.swapNonce ?? 0,
      };
      setSaved(next);
      setShoppingList(null);
      AsyncStorage.setItem(PLAN_KEY, JSON.stringify(next)).catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setGenerating(false);
    }
  };

  const toggleLock = (dayIndex: number, meal: PlannedMeal) => {
    if (!saved) return;
    const key = mealKey(dayIndex, meal.slot);
    const pinned = { ...saved.pinned };
    if (pinned[key]) delete pinned[key];
    else pinned[key] = meal.recipe.slug;
    rebuild({ seed: saved.seed, pinned });
  };

  const swapMeal = async (dayIndex: number, meal: PlannedMeal) => {
    if (!saved) return;
    const all = await loadRecipes();
    const day = saved.plan.days.find((d) => d.index === dayIndex);
    const nonce = saved.swapNonce + 1;
    const alternative = suggestSwap(
      all,
      optionsFor(settings, saved.seed, saved.pinned),
      meal.slot,
      day?.meals.map((m) => m.recipe.slug) ?? [meal.recipe.slug],
      nonce
    );
    if (!alternative) {
      showToast(t("mealPrep.noSwap"));
      return;
    }
    rebuild({
      seed: saved.seed,
      pinned: { ...saved.pinned, [mealKey(dayIndex, meal.slot)]: alternative.slug },
      swapNonce: nonce,
    });
  };

  const excludeMeal = (meal: PlannedMeal) => {
    if (!saved) return;
    Alert.alert(
      t("mealPrep.excludeConfirmTitle", { title: meal.recipe.title }),
      t("mealPrep.excludeConfirmBody"),
      [
        { text: t("home.cancel"), style: "cancel" },
        {
          text: t("mealPrep.excludeConfirm"),
          style: "destructive",
          onPress: () => {
            const s = { ...settings, excludedSlugs: [...settings.excludedSlugs, meal.recipe.slug] };
            setSettings(s);
            const pinned = Object.fromEntries(Object.entries(saved.pinned).filter(([, slug]) => slug !== meal.recipe.slug));
            rebuild({ seed: saved.seed, pinned, s });
          },
        },
      ]
    );
  };

  const addDinnersToPlanner = () => {
    if (!saved) return;
    for (const day of saved.plan.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner");
      if (dinner) setPlan(addDays(saved.startDateKey, day.index), dinner.recipe);
    }
    showToast(t("mealPrep.addedToast"));
  };

  const sharePlan = async () => {
    if (!saved) return;
    const lines = [t("mealPrep.shareHeader", { target: saved.dailyTarget }), ""];
    for (const day of saved.plan.days) {
      lines.push(`${dayLabel(saved.startDateKey, day.index)}${day.isFree ? "" : ` (${day.calories} kcal)`}`);
      if (day.isFree) lines.push(`  ${t("mealPrep.freeDayCard")}`);
      for (const meal of day.meals) {
        lines.push(
          `  ${t(`mealPrep.slot.${meal.slot}` as TranslationKey)}: ${meal.recipe.title} ×${meal.portions} · ${meal.calories} kcal${meal.isCheat ? ` ${t("mealPrep.cheatBadge")}` : ""}`
        );
      }
    }
    lines.push("", t("mealPrep.prepTitle"));
    for (const item of saved.plan.prepList) lines.push(`- ${item.recipe.title}: ${t("mealPrep.prepLine", { portions: item.portions, minutes: item.minutes })}`);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      // Share sheet dismissed; nothing to recover.
    }
  };

  const buildShoppingList = async () => {
    if (!saved) return;
    setLoadingShopping(true);
    try {
      const details = await Promise.all(saved.plan.prepList.map((p) => fetchRecipeDetail(p.recipe.slug)));
      setShoppingList(aggregatePrepIngredients(details, saved.plan.prepList));
    } catch {
      showToast(t("mealPrep.shoppingError"));
    } finally {
      setLoadingShopping(false);
    }
  };

  const shareShoppingList = async () => {
    if (!shoppingList) return;
    const lines = [t("mealPrep.shoppingListTitle"), ""];
    for (const group of groupByCategory(shoppingList)) {
      lines.push(`${categoryEmoji(group.category)} ${t(categoryLabelKey(group.category))}`);
      for (const item of group.items) lines.push(`- ${item.name}: ${formatQuantity(item.quantity, item.unit, unitSystem)}`);
      lines.push("");
    }
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      // Share sheet dismissed; nothing to recover.
    }
  };

  const logWeight = () => {
    const kg = parseInRange(weightInput, 35, 250);
    if (kg == null) return;
    const today = todayKey();
    const next = [...weightLog.filter((e) => e.date !== today), { date: today, kg }].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    setWeightLog(next);
    AsyncStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(next)).catch(() => {});
    update({ weight: String(kg) });
    setWeightInput("");
    showToast(t("mealPrep.weightLogged"));
  };

  const plan = saved?.plan;
  const weeklyKg = plan ? plan.weeklyDeficit / KCAL_PER_KG_FAT : 0;
  const recentWeights = weightLog.slice(-WEIGHT_LOG_SHOWN);
  const weightChange = weightLog.length >= 2 ? weightLog[weightLog.length - 1].kg - weightLog[0].kg : null;
  const minW = Math.min(...recentWeights.map((e) => e.kg));
  const maxW = Math.max(...recentWeights.map((e) => e.kg));

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
        {settings.excludedSlugs.length > 0 ? (
          <View style={styles.excludedRow}>
            <Text style={[styles.hint, styles.flex1, { textAlign }]}>
              {t("mealPrep.excludedCount", { count: settings.excludedSlugs.length })}
            </Text>
            <AnimatedPressable pressScale={0.92} onPress={() => update({ excludedSlugs: [] })}>
              <Text style={styles.linkText}>{t("mealPrep.clearExcluded")}</Text>
            </AnimatedPressable>
          </View>
        ) : null}

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.budgetTitle")}</Text>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("mealPrep.budgetPlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={settings.budget}
          onChangeText={(budget) => update({ budget })}
        />

        <Text style={[styles.label, { textAlign }]}>{t("mealPrep.mealsPerDay")}</Text>
        <View style={styles.chipRow}>
          <Chip label={t("mealPrep.meals3")} selected={settings.mealsPerDay === 3} onPress={() => setMealsPerDay(3)} />
          <Chip label={t("mealPrep.meals2")} selected={settings.mealsPerDay === 2} onPress={() => setMealsPerDay(2)} />
          <Chip
            label={t("mealPrep.snackToggle")}
            selected={settings.includeSnack}
            onPress={() => setIncludeSnack(!settings.includeSnack)}
          />
        </View>

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
            <View key={field} style={styles.flex1}>
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
            {slots.map((slot) => (
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
          <PrimaryButton
            label={t("mealPrep.generate")}
            onPress={() => rebuild({ seed: saved?.seed ?? 0, pinned: saved?.pinned ?? {} })}
            loading={generating}
          />
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
                <Text style={styles.statValue}>{plan.avgDailyProtein}g</Text>
                <Text style={styles.statLabel}>{t("mealPrep.statAvgProtein")}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statValue, plan.withinBudget === false && styles.overBudget]}>
                  {Math.round(plan.weeklyCost)}
                </Text>
                <Text style={styles.statLabel}>{t("mealPrep.statWeeklyCost")}</Text>
              </View>
              {weeklyKg > 0.05 ? (
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>−{weeklyKg.toFixed(1)}</Text>
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
            <Text style={[styles.hint, { textAlign }]}>{t("mealPrep.lockHint")}</Text>

            {plan.days.map((day, i) => (
              <FadeSlideIn key={day.index} index={i} style={styles.fullWidth}>
                <View style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{dayLabel(saved.startDateKey, day.index)}</Text>
                    {!day.isFree ? (
                      <Text style={styles.dayTotals}>
                        {t("mealPrep.dayTotals", {
                          calories: day.calories,
                          target: saved.dailyTarget,
                          protein: day.protein,
                          cost: Math.round(day.cost),
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {day.isFree ? (
                    <Text style={[styles.freeDayText, { textAlign }]}>{t("mealPrep.freeDayCard")}</Text>
                  ) : (
                    day.meals.map((meal) => (
                      <View key={meal.slot} style={styles.mealRow}>
                        <AnimatedPressable
                          style={styles.mealMain}
                          pressScale={0.98}
                          onPress={() => navigation.navigate("RecipeDetail", { slug: meal.recipe.slug })}
                        >
                          <Text style={styles.mealEmoji}>{CUISINE_EMOJI[meal.recipe.cuisine.slug] ?? "🍽️"}</Text>
                          <View style={styles.flex1}>
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
                                protein: meal.protein,
                                cost: Math.round(meal.cost),
                              })}
                            </Text>
                          </View>
                        </AnimatedPressable>
                        <View style={styles.mealActions}>
                          <AnimatedPressable
                            style={styles.iconButton}
                            pressScale={0.85}
                            onPress={() => toggleLock(day.index, meal)}
                            accessibilityRole="button"
                            accessibilityLabel={t(meal.isPinned ? "mealPrep.unlock" : "mealPrep.lock")}
                          >
                            <Text style={styles.iconText}>{meal.isPinned ? "🔒" : "🔓"}</Text>
                          </AnimatedPressable>
                          <AnimatedPressable
                            style={styles.iconButton}
                            pressScale={0.85}
                            onPress={() => swapMeal(day.index, meal)}
                            accessibilityRole="button"
                            accessibilityLabel={t("mealPrep.swap")}
                          >
                            <Text style={styles.iconText}>🔀</Text>
                          </AnimatedPressable>
                          <AnimatedPressable
                            style={styles.iconButton}
                            pressScale={0.85}
                            onPress={() => excludeMeal(meal)}
                            accessibilityRole="button"
                            accessibilityLabel={t("mealPrep.exclude")}
                          >
                            <Text style={styles.iconText}>🚫</Text>
                          </AnimatedPressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </FadeSlideIn>
            ))}

            <View style={styles.prepCard}>
              <Text style={[styles.prepTitle, { textAlign }]}>{t("mealPrep.prepTitle")}</Text>
              {plan.prepList.map((item, i) => (
                <View key={item.recipe.slug} style={styles.prepRow}>
                  <Text style={styles.prepName} numberOfLines={1}>
                    {i + 1}. {item.recipe.title}
                  </Text>
                  <Text style={styles.prepPortions}>
                    {t("mealPrep.prepLine", { portions: item.portions, minutes: item.minutes })}
                  </Text>
                </View>
              ))}
              <Text style={[styles.prepTotal, { textAlign }]}>
                {t("mealPrep.prepTotal", {
                  hours: Math.floor(plan.totalPrepMinutes / 60),
                  minutes: plan.totalPrepMinutes % 60,
                })}
              </Text>
            </View>

            <View style={styles.fullWidth}>
              <PrimaryButton
                label={t("mealPrep.shoppingList")}
                variant="outline"
                onPress={buildShoppingList}
                loading={loadingShopping}
              />
            </View>
            {shoppingList ? (
              <View style={styles.shoppingCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{t("mealPrep.shoppingListTitle")}</Text>
                  <AnimatedPressable pressScale={0.92} onPress={shareShoppingList}>
                    <Text style={styles.linkText}>{t("mealPrep.shareShopping")}</Text>
                  </AnimatedPressable>
                </View>
                {groupByCategory(shoppingList).map((group) => (
                  <View key={group.category} style={styles.aisleGroup}>
                    <Text style={[styles.aisleTitle, { textAlign }]}>
                      {categoryEmoji(group.category)} {t(categoryLabelKey(group.category))}
                    </Text>
                    {group.items.map((item) => (
                      <View key={`${item.name}|${item.unit}`} style={styles.prepRow}>
                        <Text style={styles.prepName}>{item.name}</Text>
                        <Text style={styles.prepPortions}>{formatQuantity(item.quantity, item.unit, unitSystem)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.fullWidth}>
              <PrimaryButton
                label={t("mealPrep.regenerate")}
                variant="outline"
                onPress={() => rebuild({ seed: saved.seed + 1, pinned: saved.pinned })}
                loading={generating}
              />
            </View>
            <View style={styles.fullWidth}>
              <PrimaryButton label={t("mealPrep.sharePlan")} variant="outline" onPress={sharePlan} />
            </View>
            <View style={styles.fullWidth}>
              <PrimaryButton label={t("mealPrep.addDinners")} variant="outline" onPress={addDinnersToPlanner} />
            </View>
          </>
        ) : generating ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : null}

        <View style={styles.weightCard}>
          <Text style={[styles.prepTitle, { textAlign }]}>{t("mealPrep.weightTitle")}</Text>
          <View style={styles.weightInputRow}>
            <TextInput
              style={[styles.input, styles.flex1, styles.noTopMargin, { textAlign }]}
              placeholder={t("mealPrep.weightPlaceholder")}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <AnimatedPressable
              style={[styles.logButton, parseInRange(weightInput, 35, 250) == null && styles.disabled]}
              pressScale={0.92}
              onPress={logWeight}
              disabled={parseInRange(weightInput, 35, 250) == null}
            >
              <Text style={styles.logButtonText}>{t("mealPrep.logWeight")}</Text>
            </AnimatedPressable>
          </View>
          {recentWeights.length === 0 ? (
            <Text style={[styles.hint, { textAlign }]}>{t("mealPrep.weightEmpty")}</Text>
          ) : (
            <>
              {weightChange != null ? (
                <Text style={[styles.weightChange, weightChange <= 0 ? styles.withinBudget : styles.overBudget, { textAlign }]}>
                  {t("mealPrep.weightChange", {
                    change: `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}`,
                    date: shortDate(weightLog[0].date),
                  })}
                </Text>
              ) : null}
              <View style={styles.weightBars}>
                {recentWeights.map((entry) => {
                  const range = maxW - minW || 1;
                  const height = 24 + ((entry.kg - minW) / range) * 56;
                  return (
                    <View key={entry.date} style={styles.weightBarCol}>
                      <Text style={styles.weightBarValue}>{entry.kg}</Text>
                      <View style={[styles.weightBar, { height }]} />
                      <Text style={styles.weightBarDate}>{shortDate(entry.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <Text style={[styles.disclaimer, { textAlign }]}>{t("mealPrep.disclaimer")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6), alignItems: "center" },
    fullWidth: { width: "100%", marginTop: spacing(1.5) },
    flex1: { flex: 1 },
    emoji: { fontSize: 48, marginBottom: spacing(1) },
    title: { fontSize: 22, fontWeight: "800", color: colors.text, width: "100%" },
    subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing(1), lineHeight: 20, width: "100%" },
    label: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing(2.5), width: "100%" },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: 2, width: "100%" },
    linkText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
    excludedRow: { flexDirection: "row", alignItems: "center", width: "100%", marginTop: spacing(1) },
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
    noTopMargin: { marginTop: 0 },
    bodyRow: { flexDirection: "row", width: "100%", gap: spacing(1), marginTop: spacing(0.5) },
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
    spinner: { marginTop: spacing(3) },
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
    dayTotals: { fontSize: 11, fontWeight: "700", color: colors.primaryDark, flexShrink: 1, marginStart: spacing(1) },
    freeDayText: { fontSize: 13, color: colors.textMuted },
    mealRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing(0.75) },
    mealMain: { flex: 1, flexDirection: "row", alignItems: "center" },
    mealEmoji: { fontSize: 22, marginEnd: spacing(1.25) },
    mealSlot: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    mealTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 1 },
    mealMeta: { fontSize: 11, fontWeight: "600", color: colors.primaryDark, marginTop: 1 },
    mealActions: { flexDirection: "row", marginStart: spacing(0.5) },
    iconButton: { padding: spacing(0.5) },
    iconText: { fontSize: 16 },
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
    prepTotal: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: spacing(1) },
    shoppingCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing(1.5),
      marginTop: spacing(1.5),
    },
    aisleGroup: { marginBottom: spacing(1) },
    aisleTitle: { fontSize: 12, fontWeight: "800", color: colors.textMuted, marginTop: spacing(0.5) },
    weightCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing(1.5),
      marginTop: spacing(3),
    },
    weightInputRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginBottom: spacing(1) },
    logButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
    },
    logButtonText: { color: "#fff", fontWeight: "700" },
    disabled: { opacity: 0.5 },
    weightChange: { fontSize: 13, fontWeight: "700", marginBottom: spacing(1) },
    weightBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing(1) },
    weightBarCol: { flex: 1, alignItems: "center" },
    weightBarValue: { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
    weightBar: { width: 14, borderRadius: 4, backgroundColor: colors.primary },
    weightBarDate: { fontSize: 9, color: colors.textMuted, marginTop: 3 },
    disclaimer: { fontSize: 11, color: colors.textMuted, marginTop: spacing(2), width: "100%", lineHeight: 16 },
  });
