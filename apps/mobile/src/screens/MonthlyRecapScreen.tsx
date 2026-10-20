import React, { useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useCookingJournal, type JournalEntry } from "../context/CookingJournalContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { moneySaved } from "../utils/moneySaved";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MonthlyRecap">;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function entryMonth(e: JournalEntry): string {
  return monthKey(new Date(e.finishedAt));
}

function mostCommon<T>(items: T[]): { item: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: { item: T; count: number } | null = null;
  for (const [item, count] of counts) if (!best || count > best.count) best = { item, count };
  return best;
}

export function MonthlyRecapScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { entries } = useCookingJournal();
  const [offset, setOffset] = useState(0);
  const textAlign = isRTL ? "right" : "left";

  const target = new Date();
  target.setDate(1);
  target.setMonth(target.getMonth() - offset);
  const key = monthKey(target);
  const monthLabel = `${t(`month.${target.getMonth()}` as TranslationKey)} ${target.getFullYear()}`;

  const month = entries.filter((e) => entryMonth(e) === key);
  // A cuisine is "new" this month when its first-ever journal entry falls in it.
  const firstMonthByCuisine = new Map<string, string>();
  for (const e of entries) firstMonthByCuisine.set(e.cuisineSlug, entryMonth(e));
  const newCuisines = [...new Set(month.map((e) => e.cuisineSlug))].filter((c) => firstMonthByCuisine.get(c) === key);
  const minutes = month.reduce((sum, e) => sum + e.durationMin, 0);
  const topCuisine = mostCommon(month.map((e) => e.cuisineSlug));
  const topRecipe = mostCommon(month.map((e) => e.title));
  const saved = moneySaved(month);
  const portions = month.reduce((sum, e) => sum + e.servings, 0);

  const share = () =>
    Share.share({
      message: [
        t("monthlyRecap.shareTitle", { month: monthLabel }),
        t("monthlyRecap.shareLine", { count: month.length, hours: Math.round((minutes / 60) * 10) / 10, saved }),
        topRecipe ? t("monthlyRecap.topRecipe", { title: topRecipe.item, count: topRecipe.count }) : "",
        "",
        t("share.branding"),
      ]
        .filter(Boolean)
        .join("\n"),
    }).catch(() => {});

  const stats: { emoji: string; text: string }[] = [
    { emoji: "👩‍🍳", text: t("monthlyRecap.meals", { count: month.length }) },
    { emoji: "🍽️", text: t("monthlyRecap.portions", { count: portions }) },
    { emoji: "⏱", text: t("monthlyRecap.time", { hours: Math.round((minutes / 60) * 10) / 10 }) },
    { emoji: "💰", text: t("monthlyRecap.saved", { amount: saved }) },
  ];
  if (topCuisine) {
    stats.push({ emoji: CUISINE_EMOJI[topCuisine.item] ?? "🌍", text: t("monthlyRecap.topCuisine", { count: topCuisine.count }) });
  }
  if (topRecipe) stats.push({ emoji: "⭐", text: t("monthlyRecap.topRecipe", { title: topRecipe.item, count: topRecipe.count }) });
  if (newCuisines.length > 0) {
    stats.push({
      emoji: "🛂",
      text: t("monthlyRecap.newCuisines", { count: newCuisines.length, emojis: newCuisines.map((c) => CUISINE_EMOJI[c] ?? "🍽️").join(" ") }),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthRow}>
          <AnimatedPressable pressScale={0.9} onPress={() => setOffset((o) => o + 1)} accessibilityLabel={t("monthlyRecap.previous")}>
            <Text style={styles.arrow}>{isRTL ? "›" : "‹"}</Text>
          </AnimatedPressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <AnimatedPressable
            pressScale={0.9}
            disabled={offset === 0}
            onPress={() => setOffset((o) => Math.max(0, o - 1))}
            accessibilityLabel={t("monthlyRecap.next")}
          >
            <Text style={[styles.arrow, offset === 0 && styles.disabled]}>{isRTL ? "‹" : "›"}</Text>
          </AnimatedPressable>
        </View>

        {month.length === 0 ? (
          <Text style={[styles.empty, { textAlign: "center" }]}>{t("monthlyRecap.empty")}</Text>
        ) : (
          stats.map((s, i) => (
            <FadeSlideIn key={s.text} index={i}>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>{s.emoji}</Text>
                <Text style={[styles.statText, { textAlign }]}>{s.text}</Text>
              </View>
            </FadeSlideIn>
          ))
        )}

        <View style={styles.buttonGap}>
          <PrimaryButton label={t("monthlyRecap.share")} onPress={share} disabled={month.length === 0} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("journal.title")} variant="outline" onPress={() => navigation.navigate("CookingJournal")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(2) },
    arrow: { fontSize: 30, fontWeight: "800", color: colors.primary, paddingHorizontal: spacing(2) },
    disabled: { opacity: 0.25 },
    monthLabel: { fontSize: 18, fontWeight: "800", color: colors.text },
    empty: { color: colors.textMuted, marginVertical: spacing(4), lineHeight: 20 },
    statCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.75),
      marginBottom: spacing(1),
    },
    statEmoji: { fontSize: 26, marginEnd: spacing(1.5) },
    statText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
    buttonGap: { marginTop: spacing(1.5) },
  });
