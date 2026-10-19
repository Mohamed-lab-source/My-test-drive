import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useHiddenRecipes } from "../context/HiddenRecipesContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { intersectAllergens, useMyAllergies } from "../utils/allergens";
import { useInSeason } from "../utils/useInSeason";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Discover">;

const BUDGETS = [30, 50, 80, 120];
const TIME_LIMITS: (number | null)[] = [null, 30, 60];

export function DiscoverScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isHidden, hidden } = useHiddenRecipes();
  const myAllergies = useMyAllergies();
  const { produce, ingredientIds } = useInSeason();
  const [catalog, setCatalog] = useState<RecipeSummary[]>([]);
  const [budget, setBudget] = useState(50);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [seasonalCount, setSeasonalCount] = useState<number | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchRecipes({}).then(setCatalog).catch(() => {});
  }, [locale]);

  useEffect(() => {
    if (ingredientIds.length === 0) return;
    fetchRecipes({ ingredients: ingredientIds.join(",") })
      .then((data) => setSeasonalCount(data.filter((r) => !isHidden(r.slug)).length))
      .catch(() => {});
  }, [ingredientIds, isHidden]);

  const surpriseMe = () => {
    const pool = catalog.filter(
      (r) =>
        r.costPerServing <= budget &&
        (timeLimit == null || r.prepMinutes + r.cookMinutes <= timeLimit) &&
        r.dishType !== "Beverage" &&
        !isHidden(r.slug) &&
        intersectAllergens(r.allergens, myAllergies).length === 0
    );
    if (pool.length === 0) {
      Alert.alert(t("discover.noSurprise"));
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigation.navigate("RecipeDetail", { slug: pick.slug });
  };

  const monthName = t(`month.${new Date().getMonth()}` as TranslationKey);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("discover.surpriseTitle")}</Text>
          <Text style={[styles.label, { textAlign }]}>{t("discover.budgetLabel")}</Text>
          <View style={styles.chipRow}>
            {BUDGETS.map((b) => (
              <Chip key={b} label={t("discover.underBudget", { amount: b })} selected={budget === b} onPress={() => setBudget(b)} />
            ))}
          </View>
          <Text style={[styles.label, { textAlign }]}>{t("discover.timeLabel")}</Text>
          <View style={styles.chipRow}>
            {TIME_LIMITS.map((m) => (
              <Chip
                key={String(m)}
                label={m == null ? t("discover.anyTime") : t("discover.underMinutes", { minutes: m })}
                selected={timeLimit === m}
                onPress={() => setTimeLimit(m)}
              />
            ))}
          </View>
          <View style={styles.buttonGap}>
            <PrimaryButton label={t("discover.surpriseButton")} onPress={surpriseMe} disabled={catalog.length === 0} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("discover.seasonTitle", { month: monthName })}</Text>
          <Text style={[styles.muted, { textAlign }]}>{t("discover.seasonSubtitle")}</Text>
          <View style={styles.chipRow}>
            {produce.map((p) => (
              <View key={p.en} style={styles.producePill}>
                <Text style={styles.produceText}>
                  {p.emoji} {p[locale]}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.buttonGap}>
            <PrimaryButton
              label={
                seasonalCount != null
                  ? t("discover.seasonButtonCount", { count: seasonalCount })
                  : t("discover.seasonButton")
              }
              variant="outline"
              onPress={() => navigation.navigate("RecipeList", { title: t("discover.seasonListTitle"), inSeason: true })}
            />
          </View>
        </View>

        <AnimatedPressable style={styles.linkCard} pressScale={0.98} onPress={() => navigation.navigate("CuisineExplorer")}>
          <Text style={styles.linkEmoji}>🗺️</Text>
          <View style={styles.flex1}>
            <Text style={[styles.linkTitle, { textAlign }]}>{t("cuisineExplorer.title")}</Text>
            <Text style={[styles.muted, { textAlign }]}>{t("discover.explorerSubtitle")}</Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable style={styles.linkCard} pressScale={0.98} onPress={() => navigation.navigate("HiddenRecipes")}>
          <Text style={styles.linkEmoji}>🙈</Text>
          <View style={styles.flex1}>
            <Text style={[styles.linkTitle, { textAlign }]}>{t("hidden.title")}</Text>
            <Text style={[styles.muted, { textAlign }]}>{t("discover.hiddenSubtitle", { count: hidden.length })}</Text>
          </View>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2),
      marginBottom: spacing(2),
    },
    cardTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    label: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginTop: spacing(1.5), marginBottom: spacing(0.75) },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginTop: spacing(0.5) },
    buttonGap: { marginTop: spacing(2) },
    muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
    producePill: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: 5,
    },
    produceText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
    linkCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2),
      marginBottom: spacing(1.5),
    },
    linkEmoji: { fontSize: 28, marginEnd: spacing(1.5) },
    flex1: { flex: 1 },
    linkTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  });
