import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useCookStreak } from "../context/CookStreakContext";
import { useCookingJournal } from "../context/CookingJournalContext";
import { useGoals } from "../context/GoalsContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { moneySaved } from "../utils/moneySaved";
import { useWeeklyChallenge } from "../utils/useWeeklyChallenge";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Goals">;

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function GoalsScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { weeklyGoal, setWeeklyGoal, cookDaysThisWeek, goalMetThisWeek, weeksHit } = useGoals();
  const { displayStreak, longestStreak, freezeAvailable, freezeProtecting } = useCookStreak();
  const { entries } = useCookingJournal();
  const { cuisine: challenge, completed: challengeDone } = useWeeklyChallenge();
  const textAlign = isRTL ? "right" : "left";
  const saved = moneySaved(entries);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("goals.weeklyTitle")}</Text>
          <Text style={[styles.big, goalMetThisWeek && styles.success]}>
            {t("goals.progress", { done: Math.min(cookDaysThisWeek, weeklyGoal), goal: weeklyGoal })}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(100, (cookDaysThisWeek / weeklyGoal) * 100)}%` },
                goalMetThisWeek && styles.fillDone,
              ]}
            />
          </View>
          <Text style={[styles.muted, { textAlign }]}>
            {goalMetThisWeek ? t("goals.metMessage") : t("goals.leftMessage", { count: weeklyGoal - cookDaysThisWeek })}
          </Text>
          <Text style={[styles.label, { textAlign }]}>{t("goals.chooseGoal")}</Text>
          <View style={styles.chipRow}>
            {GOAL_OPTIONS.map((n) => (
              <Chip key={n} label={t("goals.daysOption", { count: n })} selected={weeklyGoal === n} onPress={() => setWeeklyGoal(n)} />
            ))}
          </View>
          <Text style={[styles.muted, styles.topGap, { textAlign }]}>{t("goals.weeksHit", { count: weeksHit.length })}</Text>
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("goals.streakTitle")}</Text>
          <Text style={styles.big}>{t("goals.streakValue", { count: displayStreak })}</Text>
          <Text style={[styles.muted, { textAlign }]}>{t("goals.longest", { count: longestStreak })}</Text>
          <Text style={[styles.freeze, { textAlign }]}>
            {freezeProtecting
              ? t("goals.freezeProtecting")
              : freezeAvailable
                ? t("goals.freezeReady")
                : t("goals.freezeUsed")}
          </Text>
        </View>

        {challenge ? (
          <AnimatedPressable
            style={[styles.card, challengeDone && styles.cardDone]}
            pressScale={0.98}
            onPress={() => navigation.navigate("RecipeList", { cuisineSlug: challenge.slug, title: challenge.name })}
          >
            <Text style={[styles.cardTitle, { textAlign }]}>{t("goals.challengeTitle")}</Text>
            <Text style={[styles.challenge, { textAlign }]}>
              {CUISINE_EMOJI[challenge.slug] ?? "🍽️"}{" "}
              {challengeDone ? t("goals.challengeDone", { cuisine: challenge.name }) : t("goals.challenge", { cuisine: challenge.name })}
            </Text>
          </AnimatedPressable>
        ) : null}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("goals.savedTitle")}</Text>
          <Text style={[styles.big, styles.success]}>{t("goals.savedValue", { amount: saved })}</Text>
          <Text style={[styles.muted, { textAlign }]}>{t("goals.savedExplainer")}</Text>
        </View>

        <View style={styles.buttonGap}>
          <PrimaryButton label={t("passport.title")} variant="outline" onPress={() => navigation.navigate("CuisinePassport")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("monthlyRecap.title")} variant="outline" onPress={() => navigation.navigate("MonthlyRecap")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("goals.badgesLink")} variant="outline" onPress={() => navigation.navigate("Badges")} />
        </View>
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
      marginBottom: spacing(1.5),
    },
    cardDone: { borderColor: colors.success },
    cardTitle: { fontSize: 13, fontWeight: "800", color: colors.textMuted },
    big: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: spacing(0.75) },
    success: { color: colors.success },
    track: { height: 10, borderRadius: 5, backgroundColor: colors.chipBackground, overflow: "hidden", marginVertical: spacing(1) },
    fill: { height: "100%", borderRadius: 5, backgroundColor: colors.primary },
    fillDone: { backgroundColor: colors.success },
    muted: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    topGap: { marginTop: spacing(1.5) },
    label: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing(1.5), marginBottom: spacing(0.75) },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    freeze: { fontSize: 13, fontWeight: "700", color: colors.secondary, marginTop: spacing(1) },
    challenge: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: spacing(0.75) },
    buttonGap: { marginTop: spacing(1) },
  });
