import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { useMealPlan } from "../context/MealPlanContext";
import { useCookStreak } from "../context/CookStreakContext";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CookingCalendar">;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CookingCalendarScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { plan } = useMealPlan();
  const { cookLog } = useCookStreak();
  const cookedSet = useMemo(() => new Set(cookLog), [cookLog]);
  const [monthOffset, setMonthOffset] = useState(0);
  const textAlign = isRTL ? "right" : "left";

  const viewDate = new Date();
  viewDate.setDate(1);
  viewDate.setMonth(viewDate.getMonth() + monthOffset);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad2(month + 1)}-${pad2(i + 1)}`),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthRow}>
          <AnimatedPressable style={styles.navButton} pressScale={0.9} onPress={() => setMonthOffset((o) => o - 1)}>
            <Text style={styles.navButtonText}>{isRTL ? "›" : "‹"}</Text>
          </AnimatedPressable>
          <Text style={styles.monthTitle}>
            {t(`month.${month}` as TranslationKey)} {year}
          </Text>
          <AnimatedPressable style={styles.navButton} pressScale={0.9} onPress={() => setMonthOffset((o) => o + 1)}>
            <Text style={styles.navButtonText}>{isRTL ? "‹" : "›"}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.weekdayRow}>
          {Array.from({ length: 7 }, (_, i) => (
            <Text key={i} style={styles.weekdayLabel}>
              {t(`weekdayShort.${i}` as TranslationKey)}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((dateKey, i) => {
            if (!dateKey) return <View key={i} style={styles.cell} />;
            const recipe = plan[dateKey];
            const cooked = cookedSet.has(dateKey);
            const dayNum = Number(dateKey.slice(-2));
            return (
              <AnimatedPressable
                key={dateKey}
                style={styles.cell}
                pressScale={0.92}
                disabled={!recipe}
                onPress={() => recipe && navigation.navigate("RecipeDetail", { slug: recipe.slug })}
              >
                <View style={[styles.cellInner, recipe && styles.cellPlanned, cooked && styles.cellCooked]}>
                  <Text style={[styles.cellNum, (recipe || cooked) && styles.cellNumActive]}>{dayNum}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.cellPlanned]} />
            <Text style={[styles.legendText, { textAlign }]}>{t("cookingCalendar.legendPlanned")}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.cellCooked]} />
            <Text style={[styles.legendText, { textAlign }]}>{t("cookingCalendar.legendCooked")}</Text>
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
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(2) },
    monthTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    navButtonText: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    weekdayRow: { flexDirection: "row", marginBottom: spacing(1) },
    weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.textMuted },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 3 },
    cellInner: { width: "100%", height: "100%", borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
    cellPlanned: { backgroundColor: colors.chipBackground, borderWidth: 1.5, borderColor: colors.primary },
    cellCooked: { backgroundColor: colors.primary },
    cellNum: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    cellNumActive: { color: colors.text, fontWeight: "800" },
    legendRow: { flexDirection: "row", marginTop: spacing(3) },
    legendItem: { flexDirection: "row", alignItems: "center", marginEnd: spacing(3) },
    legendSwatch: { width: 16, height: 16, borderRadius: 4, marginEnd: spacing(1) },
    legendText: { fontSize: 13, color: colors.textMuted },
  });
