import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "CompareRecipes">;

const MAX_CANDIDATES = 20;
const DIFFICULTY_RANK = { EASY: 0, MEDIUM: 1, HARD: 2 } as const;

type Row = {
  labelKey: TranslationKey;
  value: (r: RecipeSummary) => string;
  /** Which side wins: a smaller number, a larger one, or no winner (text rows). */
  score?: (r: RecipeSummary) => number;
  better?: "lower" | "higher";
};

export function CompareRecipesScreen({ route, navigation }: Props) {
  const { slugA } = route.params;
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [catalog, setCatalog] = useState<RecipeSummary[] | null>(null);
  const [slugB, setSlugB] = useState<string | undefined>(route.params.slugB);
  const [query, setQuery] = useState("");
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchRecipes({})
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, [locale]);

  if (catalog === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const a = catalog.find((r) => r.slug === slugA);
  const b = slugB ? catalog.find((r) => r.slug === slugB) : undefined;

  const rows: Row[] = [
    {
      labelKey: "compare.time",
      value: (r) => `${r.prepMinutes + r.cookMinutes} ${t("recipeDetail.min")}`,
      score: (r) => r.prepMinutes + r.cookMinutes,
      better: "lower",
    },
    {
      labelKey: "compare.difficulty",
      value: (r) => t(`difficulty.${r.difficulty}` as TranslationKey),
      score: (r) => DIFFICULTY_RANK[r.difficulty],
      better: "lower",
    },
    {
      labelKey: "compare.cost",
      value: (r) => t("recipeCard.costPerServing", { cost: Math.round(r.costPerServing) }),
      score: (r) => r.costPerServing,
      better: "lower",
    },
    { labelKey: "compare.calories", value: (r) => `${r.caloriesPerServing}`, score: (r) => r.caloriesPerServing, better: "lower" },
    { labelKey: "compare.protein", value: (r) => `${r.proteinPerServing} g`, score: (r) => r.proteinPerServing, better: "higher" },
    { labelKey: "compare.fat", value: (r) => `${r.fatPerServing} g`, score: (r) => r.fatPerServing, better: "lower" },
    {
      labelKey: "compare.rating",
      value: (r) => (r.avgRating != null ? `${r.avgRating.toFixed(1)}★ (${r.ratingCount})` : "—"),
      score: (r) => r.avgRating ?? 0,
      better: "higher",
    },
    {
      labelKey: "compare.ingredients",
      value: (r) => `${r.ingredientCount}`,
      score: (r) => r.ingredientCount,
      better: "lower",
    },
    {
      labelKey: "compare.allergens",
      value: (r) =>
        r.allergens.length > 0 ? r.allergens.map((x) => t(`allergen.${x}` as TranslationKey)).join(", ") : t("compare.none"),
      score: (r) => r.allergens.length,
      better: "lower",
    },
  ];

  const winner = (row: Row): "a" | "b" | null => {
    if (!a || !b || !row.score || !row.better) return null;
    const sa = row.score(a);
    const sb = row.score(b);
    if (sa === sb) return null;
    return (row.better === "lower" ? sa < sb : sa > sb) ? "a" : "b";
  };

  const wins = { a: 0, b: 0 };
  for (const row of rows) {
    const w = winner(row);
    if (w) wins[w]++;
  }

  const candidates = catalog
    .filter((r) => r.slug !== slugA && r.title.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, MAX_CANDIDATES);

  const header = (r: RecipeSummary) => (
    <AnimatedPressable
      style={styles.headerCell}
      pressScale={0.96}
      onPress={() => navigation.push("RecipeDetail", { slug: r.slug })}
    >
      <Text style={styles.headerEmoji}>{CUISINE_EMOJI[r.cuisine.slug] ?? "🍽️"}</Text>
      <Text style={styles.headerTitle} numberOfLines={3}>
        {r.title}
      </Text>
    </AnimatedPressable>
  );

  if (!a) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.muted}>{t("recipeDetail.loadErrorTitle")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {b ? (
          <>
            <View style={styles.row}>
              <View style={styles.labelCell} />
              {header(a)}
              {header(b)}
            </View>
            {rows.map((row) => {
              const w = winner(row);
              return (
                <View key={row.labelKey} style={[styles.row, styles.dataRow]}>
                  <Text style={[styles.labelCell, styles.labelText, { textAlign }]}>{t(row.labelKey)}</Text>
                  <Text style={[styles.valueCell, w === "a" && styles.winnerText]}>{row.value(a)}</Text>
                  <Text style={[styles.valueCell, w === "b" && styles.winnerText]}>{row.value(b)}</Text>
                </View>
              );
            })}
            <Text style={[styles.verdict, { textAlign }]}>
              {wins.a === wins.b
                ? t("compare.tie")
                : t("compare.verdict", { title: wins.a > wins.b ? a.title : b.title, count: Math.max(wins.a, wins.b) })}
            </Text>
            <AnimatedPressable style={styles.changeButton} pressScale={0.95} onPress={() => setSlugB(undefined)}>
              <Text style={styles.link}>{t("compare.change")}</Text>
            </AnimatedPressable>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { textAlign }]}>{t("compare.pickPrompt", { title: a.title })}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              placeholder={t("compare.searchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {candidates.map((r) => (
              <AnimatedPressable key={r.slug} style={styles.candidate} pressScale={0.98} onPress={() => setSlugB(r.slug)}>
                <Text style={[styles.candidateTitle, { textAlign }]}>
                  {CUISINE_EMOJI[r.cuisine.slug] ?? "🍽️"} {r.title}
                </Text>
                <Text style={[styles.muted, { textAlign }]}>
                  {r.cuisine.name} · {r.dishType} · {r.prepMinutes + r.cookMinutes} {t("recipeDetail.min")}
                </Text>
              </AnimatedPressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(1.5) },
    muted: { color: colors.textMuted, fontSize: 12 },
    row: { flexDirection: "row", alignItems: "stretch" },
    dataRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing(1.25) },
    labelCell: { flex: 0.9, paddingEnd: spacing(1) },
    labelText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
    headerCell: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1),
      marginHorizontal: spacing(0.5),
      marginBottom: spacing(1),
    },
    headerEmoji: { fontSize: 28 },
    headerTitle: { fontSize: 13, fontWeight: "800", color: colors.text, textAlign: "center", marginTop: 4 },
    valueCell: { flex: 1, fontSize: 13, color: colors.text, textAlign: "center", paddingHorizontal: 2 },
    winnerText: { color: colors.success, fontWeight: "800" },
    verdict: { fontSize: 15, fontWeight: "800", color: colors.primaryDark, marginTop: spacing(2) },
    changeButton: { marginTop: spacing(1.5), alignSelf: "flex-start" },
    link: { color: colors.primary, fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: spacing(1),
    },
    candidate: { paddingVertical: spacing(1.25), borderBottomWidth: 1, borderBottomColor: colors.border },
    candidateTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  });
