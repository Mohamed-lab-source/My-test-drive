import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { useCookStreak } from "../context/CookStreakContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { cookingLevelFor } from "../utils/cookingLevel";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "WeeklyRecap">;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function WeeklyRecapScreen({}: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { cookLog, recentlyCooked, displayStreak, totalCooked } = useCookStreak();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  const weekAgoKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const cookedThisWeek = useMemo(() => cookLog.filter((k) => k >= weekAgoKey && k <= todayKey()).length, [cookLog, weekAgoKey]);

  const topCuisine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of recentlyCooked) {
      if (entry.date < weekAgoKey) continue;
      counts.set(entry.cuisineSlug, (counts.get(entry.cuisineSlug) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [slug, count] of counts) {
      if (count > bestCount) {
        best = slug;
        bestCount = count;
      }
    }
    return best;
  }, [recentlyCooked, weekAgoKey]);

  const level = cookingLevelFor(totalCooked);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeSlideIn>
          <Text style={[styles.headline, { textAlign }]}>{t("recap.headline")}</Text>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>👩‍🍳</Text>
            <Text style={styles.statValue}>{t("recap.cookedThisWeek", { count: cookedThisWeek })}</Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{t("recap.currentStreak", { count: displayStreak })}</Text>
          </View>
        </FadeSlideIn>

        {topCuisine ? (
          <FadeSlideIn index={3}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>{CUISINE_EMOJI[topCuisine] ?? "🍽️"}</Text>
              <Text style={styles.statValue}>{t("recap.topCuisine", { cuisine: capitalize(topCuisine) })}</Text>
            </View>
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn index={4}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{t("recap.level", { level })}</Text>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    headline: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing(3) },
    statCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2.5),
      marginBottom: spacing(2),
      ...shadow.card,
    },
    statEmoji: { fontSize: 28, marginEnd: spacing(2) },
    statValue: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  });
