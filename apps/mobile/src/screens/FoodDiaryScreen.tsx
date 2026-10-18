import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { EmptyState } from "../components/EmptyState";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { useFoodDiary, localDayKey, shiftDayKey } from "../context/FoodDiaryContext";
import { useToast } from "../context/ToastContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "FoodDiary">;

const WEEK = 7;
/** Within ±10% of the calorie target counts as an on-target day. */
const ON_TARGET_TOLERANCE = 0.1;

function parsePositive(value: string, max: number): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

export function FoodDiaryScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";
  const { showToast } = useToast();
  const { targets, entriesFor, totalsFor, waterFor, setWater, addEntry, removeEntry, restoreEntry, setTargets, resetTargetsToAuto, loggingStreak } =
    useFoodDiary();

  const today = localDayKey();
  const [day, setDay] = useState(today);
  const [quickName, setQuickName] = useState("");
  const [quickCalories, setQuickCalories] = useState("");
  const [quickProtein, setQuickProtein] = useState("");
  const [editingTargets, setEditingTargets] = useState(false);
  const [calorieTargetInput, setCalorieTargetInput] = useState(String(targets.calories));
  const [proteinTargetInput, setProteinTargetInput] = useState(String(targets.protein));

  const dayEntries = entriesFor(day);
  const totals = totalsFor(day);
  const water = waterFor(day);
  const remaining = targets.calories - totals.calories;
  const calorieProgress = Math.min(1, totals.calories / targets.calories);
  const proteinProgress = Math.min(1, totals.protein / targets.protein);
  const proteinKcal = totals.protein * 4;
  const fatKcal = totals.fat * 9;
  const carbsKcal = totals.carbs * 4;
  // Quick-add entries often carry calories only, so whatever the macros don't explain shows as "other".
  const otherKcal = Math.max(0, totals.calories - proteinKcal - fatKcal - carbsKcal);
  const macroTotal = Math.max(1, proteinKcal + fatKcal + carbsKcal + otherKcal);

  const dayLabel = (dayKey: string) => {
    if (dayKey === today) return t("mealPlanner.today");
    if (dayKey === shiftDayKey(today, -1)) return t("diary.yesterday");
    const [y, m, d] = dayKey.split("-").map(Number);
    return t(`weekday.${new Date(y, m - 1, d).getDay()}` as TranslationKey);
  };

  const week = Array.from({ length: WEEK }, (_, i) => shiftDayKey(today, i - (WEEK - 1)));
  const weekTotals = week.map((d) => ({ day: d, ...totalsFor(d) }));
  const loggedDays = weekTotals.filter((d) => d.count > 0);
  const weekAvgCalories = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length)
    : 0;
  const weekAvgProtein = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length)
    : 0;
  const daysOnTarget = loggedDays.filter(
    (d) => Math.abs(d.calories - targets.calories) <= targets.calories * ON_TARGET_TOLERANCE
  ).length;
  const weekMax = Math.max(targets.calories, ...weekTotals.map((d) => d.calories));

  const quickCaloriesValue = parsePositive(quickCalories, 5000);
  const addQuick = () => {
    if (quickCaloriesValue == null) return;
    addEntry({
      date: day,
      title: quickName.trim() || t("diary.quickDefaultName"),
      slug: null,
      cuisineSlug: null,
      servings: 1,
      calories: Math.round(quickCaloriesValue),
      protein: Math.round(parsePositive(quickProtein, 300) ?? 0),
      fat: 0,
      carbs: 0,
    });
    setQuickName("");
    setQuickCalories("");
    setQuickProtein("");
    showToast(t("diary.logged"));
  };

  const deleteEntry = (id: string) => {
    const entry = dayEntries.find((e) => e.id === id);
    if (!entry) return;
    removeEntry(id);
    showToast(t("diary.removed"), { actionLabel: t("home.undo"), onAction: () => restoreEntry(entry) });
  };

  const saveTargets = () => {
    const calories = parsePositive(calorieTargetInput, 6000);
    const protein = parsePositive(proteinTargetInput, 400);
    setTargets(
      { ...(calories != null && { calories: Math.round(calories) }), ...(protein != null && { protein: Math.round(protein) }) },
      "manual"
    );
    setEditingTargets(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.dayNav}>
          <AnimatedPressable
            style={styles.navButton}
            pressScale={0.9}
            onPress={() => setDay(shiftDayKey(day, -1))}
            accessibilityRole="button"
            accessibilityLabel={t("diary.previousDay")}
          >
            <Text style={styles.navButtonText}>{isRTL ? "›" : "‹"}</Text>
          </AnimatedPressable>
          <Text style={styles.dayTitle}>{dayLabel(day)}</Text>
          <AnimatedPressable
            style={[styles.navButton, day === today && styles.disabled]}
            pressScale={0.9}
            disabled={day === today}
            onPress={() => setDay(shiftDayKey(day, 1))}
            accessibilityRole="button"
            accessibilityLabel={t("diary.nextDay")}
          >
            <Text style={styles.navButtonText}>{isRTL ? "‹" : "›"}</Text>
          </AnimatedPressable>
        </View>
        {loggingStreak > 0 ? (
          <Text style={styles.streak}>{t("diary.streak", { count: loggingStreak })}</Text>
        ) : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bigNumber}>{totals.calories}</Text>
            <Text style={[styles.remaining, remaining < 0 && styles.over]}>
              {remaining >= 0
                ? t("diary.remaining", { count: remaining })
                : t("diary.over", { count: -remaining })}
            </Text>
          </View>
          <Text style={[styles.muted, { textAlign }]}>{t("diary.ofTarget", { target: targets.calories })}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${calorieProgress * 100}%`, backgroundColor: remaining < 0 ? colors.danger : colors.primary },
              ]}
            />
          </View>

          <View style={[styles.rowBetween, styles.topGap]}>
            <Text style={styles.metricLabel}>{t("diary.protein")}</Text>
            <Text style={styles.metricValue}>
              {totals.protein} / {targets.protein} g
            </Text>
          </View>
          <View style={styles.trackThin}>
            <View style={[styles.fill, { width: `${proteinProgress * 100}%`, backgroundColor: colors.success }]} />
          </View>

          {totals.calories > 0 ? (
            <>
              <Text style={[styles.metricLabel, styles.topGap, { textAlign }]}>{t("diary.macroSplit")}</Text>
              <View style={styles.macroBar}>
                <View style={{ flex: proteinKcal / macroTotal, backgroundColor: colors.success }} />
                <View style={{ flex: carbsKcal / macroTotal, backgroundColor: colors.primary }} />
                <View style={{ flex: fatKcal / macroTotal, backgroundColor: colors.danger }} />
                <View style={{ flex: otherKcal / macroTotal, backgroundColor: colors.border }} />
              </View>
              <Text style={[styles.muted, { textAlign }]}>
                {t("diary.macroLegend", {
                  protein: Math.round((proteinKcal / macroTotal) * 100),
                  carbs: Math.round((carbsKcal / macroTotal) * 100),
                  fat: Math.round((fatKcal / macroTotal) * 100),
                })}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricLabel}>{t("diary.water", { count: water, target: targets.water })}</Text>
            <View style={styles.waterButtons}>
              <AnimatedPressable
                style={styles.roundButton}
                pressScale={0.85}
                onPress={() => setWater(day, water - 1)}
                accessibilityRole="button"
                accessibilityLabel={t("diary.waterLess")}
              >
                <Text style={styles.roundButtonText}>−</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.roundButton}
                pressScale={0.85}
                onPress={() => setWater(day, water + 1)}
                accessibilityRole="button"
                accessibilityLabel={t("diary.waterMore")}
              >
                <Text style={styles.roundButtonText}>+</Text>
              </AnimatedPressable>
            </View>
          </View>
          <Text style={styles.waterGlasses}>
            {Array.from({ length: Math.max(targets.water, water) }, (_, i) => (i < water ? "💧" : "○")).join(" ")}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("diary.eaten")}</Text>
        {dayEntries.length === 0 ? (
          <EmptyState icon="🍽️" message={t("diary.empty")} />
        ) : (
          dayEntries.map((entry, i) => (
            <FadeSlideIn key={entry.id} index={i} style={styles.fullWidth}>
              <View style={styles.entryRow}>
                <AnimatedPressable
                  style={styles.entryMain}
                  pressScale={0.98}
                  disabled={!entry.slug}
                  onPress={() => entry.slug && navigation.navigate("RecipeDetail", { slug: entry.slug })}
                >
                  <Text style={styles.entryEmoji}>
                    {entry.cuisineSlug ? (CUISINE_EMOJI[entry.cuisineSlug] ?? "🍽️") : "✍️"}
                  </Text>
                  <View style={styles.flex1}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {t("diary.entryMeta", { calories: entry.calories, protein: entry.protein, servings: entry.servings })}
                    </Text>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.deleteButton}
                  pressScale={0.85}
                  onPress={() => deleteEntry(entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("diary.delete")}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </AnimatedPressable>
              </View>
            </FadeSlideIn>
          ))
        )}
        <Text style={[styles.muted, styles.fullWidth, { textAlign }]}>{t("diary.logHint")}</Text>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("diary.quickAdd")}</Text>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("diary.quickNamePlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={quickName}
          onChangeText={setQuickName}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.flex1, { textAlign }]}
            placeholder={t("diary.quickCaloriesPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={quickCalories}
            onChangeText={setQuickCalories}
          />
          <TextInput
            style={[styles.input, styles.flex1, { textAlign }]}
            placeholder={t("diary.quickProteinPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={quickProtein}
            onChangeText={setQuickProtein}
          />
          <AnimatedPressable
            style={[styles.addButton, quickCaloriesValue == null && styles.disabled]}
            pressScale={0.92}
            disabled={quickCaloriesValue == null}
            onPress={addQuick}
          >
            <Text style={styles.addButtonText}>{t("diary.add")}</Text>
          </AnimatedPressable>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("diary.thisWeek")}</Text>
        <View style={styles.card}>
          <View style={styles.weekBars}>
            {weekTotals.map((d) => {
              const pct = d.calories / weekMax;
              const onTarget = Math.abs(d.calories - targets.calories) <= targets.calories * ON_TARGET_TOLERANCE;
              return (
                <AnimatedPressable key={d.day} style={styles.weekCol} pressScale={0.9} onPress={() => setDay(d.day)}>
                  <View style={styles.weekBarTrack}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: `${Math.max(pct * 100, d.count > 0 ? 4 : 0)}%`,
                          backgroundColor: d.count === 0 ? colors.border : onTarget ? colors.success : colors.primary,
                        },
                      ]}
                    />
                    <View style={[styles.targetLine, { bottom: `${(targets.calories / weekMax) * 100}%` }]} />
                  </View>
                  <Text style={[styles.weekLabel, d.day === day && styles.weekLabelActive]}>
                    {t(`weekdayShort.${(() => {
                      const [y, m, dd] = d.day.split("-").map(Number);
                      return new Date(y, m - 1, dd).getDay();
                    })()}` as TranslationKey)}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <View style={[styles.rowBetween, styles.topGap]}>
            <View style={styles.weekStat}>
              <Text style={styles.metricValue}>{weekAvgCalories}</Text>
              <Text style={styles.muted}>{t("diary.weekAvgCalories")}</Text>
            </View>
            <View style={styles.weekStat}>
              <Text style={styles.metricValue}>{weekAvgProtein}g</Text>
              <Text style={styles.muted}>{t("diary.weekAvgProtein")}</Text>
            </View>
            <View style={styles.weekStat}>
              <Text style={styles.metricValue}>
                {daysOnTarget}/{loggedDays.length}
              </Text>
              <Text style={styles.muted}>{t("diary.daysOnTarget")}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.rowBetween, styles.fullWidth, styles.topGap]}>
          <Text style={styles.sectionTitleInline}>{t("diary.targets")}</Text>
          <AnimatedPressable
            pressScale={0.92}
            onPress={() => {
              setCalorieTargetInput(String(targets.calories));
              setProteinTargetInput(String(targets.protein));
              setEditingTargets((v) => !v);
            }}
          >
            <Text style={styles.link}>{editingTargets ? t("home.cancel") : t("diary.editTargets")}</Text>
          </AnimatedPressable>
        </View>
        {editingTargets ? (
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.flex1, { textAlign }]}
              keyboardType="number-pad"
              value={calorieTargetInput}
              onChangeText={setCalorieTargetInput}
              accessibilityLabel={t("diary.calorieTarget")}
            />
            <TextInput
              style={[styles.input, styles.flex1, { textAlign }]}
              keyboardType="number-pad"
              value={proteinTargetInput}
              onChangeText={setProteinTargetInput}
              accessibilityLabel={t("diary.proteinTarget")}
            />
            <AnimatedPressable style={styles.addButton} pressScale={0.92} onPress={saveTargets}>
              <Text style={styles.addButtonText}>{t("diary.save")}</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <Text style={[styles.muted, styles.fullWidth, { textAlign }]}>
            {t(targets.source === "auto" ? "diary.targetsAuto" : "diary.targetsManual", {
              calories: targets.calories,
              protein: targets.protein,
            })}
          </Text>
        )}
        {targets.source === "manual" ? (
          <AnimatedPressable
            style={styles.fullWidth}
            pressScale={0.95}
            onPress={() => {
              resetTargetsToAuto();
              navigation.navigate("MealPrep");
            }}
          >
            <Text style={[styles.link, { textAlign }]}>{t("diary.useCalculator")}</Text>
          </AnimatedPressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6), alignItems: "center" },
    fullWidth: { width: "100%" },
    flex1: { flex: 1 },
    dayNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
    navButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    navButtonText: { fontSize: 22, fontWeight: "800", color: colors.primaryDark },
    disabled: { opacity: 0.4 },
    dayTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    streak: { fontSize: 13, fontWeight: "700", color: colors.primaryDark, marginTop: spacing(1) },
    card: {
      width: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing(2),
      marginTop: spacing(2),
      ...shadow.card,
    },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    topGap: { marginTop: spacing(1.5) },
    bigNumber: { fontSize: 32, fontWeight: "800", color: colors.text },
    remaining: { fontSize: 13, fontWeight: "700", color: colors.success },
    over: { color: colors.danger },
    muted: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    track: { height: 10, borderRadius: 5, backgroundColor: colors.chipBackground, overflow: "hidden", marginTop: spacing(1) },
    trackThin: { height: 6, borderRadius: 3, backgroundColor: colors.chipBackground, overflow: "hidden", marginTop: spacing(0.75) },
    fill: { height: "100%", borderRadius: 5 },
    metricLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
    metricValue: { fontSize: 15, fontWeight: "800", color: colors.text },
    macroBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: spacing(0.75) },
    waterButtons: { flexDirection: "row", gap: spacing(1) },
    roundButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    roundButtonText: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    waterGlasses: { fontSize: 16, marginTop: spacing(1), color: colors.textMuted },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1), width: "100%" },
    sectionTitleInline: { fontSize: 16, fontWeight: "800", color: colors.text },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing(1.25),
      marginBottom: spacing(1),
    },
    entryMain: { flex: 1, flexDirection: "row", alignItems: "center" },
    entryEmoji: { fontSize: 22, marginEnd: spacing(1.25) },
    entryTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    entryMeta: { fontSize: 11, fontWeight: "600", color: colors.primaryDark, marginTop: 2 },
    deleteButton: { padding: spacing(1) },
    deleteText: { fontSize: 14, color: colors.textMuted, fontWeight: "700" },
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
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing(1), width: "100%" },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.4),
    },
    addButtonText: { color: "#fff", fontWeight: "700" },
    weekBars: { flexDirection: "row", height: 110, alignItems: "flex-end" },
    weekCol: { flex: 1, alignItems: "center", height: "100%" },
    weekBarTrack: { flex: 1, width: 16, justifyContent: "flex-end" },
    weekBar: { width: "100%", borderRadius: 4 },
    targetLine: { position: "absolute", left: -6, right: -6, height: 1, backgroundColor: colors.textMuted, opacity: 0.6 },
    weekLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    weekLabelActive: { color: colors.primaryDark, fontWeight: "800" },
    weekStat: { alignItems: "center", flex: 1 },
    link: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
  });
