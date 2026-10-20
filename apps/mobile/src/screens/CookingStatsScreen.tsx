import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedBar } from "../components/AnimatedBar";
import { useCookStreak } from "../context/CookStreakContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CookingStats">;

const DAYS_SHOWN = 14;
const CHART_HEIGHT = 80;
const MIN_BAR_HEIGHT = 6;

function dateKeyFor(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function CookingStatsScreen({}: Props) {
  const { displayStreak, longestStreak, totalCooked, cookLog } = useCookStreak();
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  const days = useMemo(() => {
    const cookedSet = new Set(cookLog);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const offset = DAYS_SHOWN - 1 - i;
      const dateKey = dateKeyFor(offset);
      const dayOfMonth = new Date(dateKey + "T00:00:00").getDate();
      return { dateKey, cooked: cookedSet.has(dateKey), dayOfMonth };
    });
  }, [cookLog]);

  const cookedInWindow = days.filter((d) => d.cooked).length;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>🔥 {displayStreak}</Text>
            <Text style={styles.statLabel}>{t("profile.streakCurrent")}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>{t("profile.streakLongest")}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{totalCooked}</Text>
            <Text style={styles.statLabel}>{t("profile.streakTotal")}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>
          {t("cookingStats.last14Days", { count: cookedInWindow })}
        </Text>
        <View style={styles.chartCard}>
          <View style={styles.chart}>
            {days.map((d, i) => (
              <View key={d.dateKey} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <AnimatedBar
                    targetHeight={d.cooked ? CHART_HEIGHT : MIN_BAR_HEIGHT}
                    color={d.cooked ? colors.primary : colors.chipBackground}
                    delay={i * 25}
                    style={styles.bar}
                  />
                </View>
                <Text style={styles.barLabel}>{d.dayOfMonth}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.chipBackground,
      borderRadius: 14,
      paddingVertical: spacing(1.5),
      marginBottom: spacing(3),
    },
    statTile: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing(1.5) },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2),
      ...shadow.card,
    },
    chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    barColumn: { alignItems: "center", flex: 1 },
    barTrack: { height: CHART_HEIGHT, justifyContent: "flex-end" },
    bar: { width: 10, borderRadius: 5 },
    barLabel: { fontSize: 9, color: colors.textMuted, marginTop: spacing(0.75) },
  });
