import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useFasting } from "../context/FastingContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { fastHours, fastingStats } from "../utils/fasting";
import { formatClock } from "../utils/recipeBadges";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Fasting">;

const GOALS = [12, 14, 16, 18, 20];
const MILESTONES = [4, 8, 12, 16];
const HISTORY_SHOWN = 10;

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function FastingScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { active, history, startFast, adjustStart, endFast, cancelFast } = useFasting();
  const [goal, setGoal] = useState(16);
  const [now, setNow] = useState(Date.now());
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(handle);
  }, [active]);

  const stats = fastingStats(history);
  const elapsedMs = active ? now - active.start : 0;
  const goalMs = active ? active.goalHours * 3600000 : 0;
  const progress = active ? Math.min(1, elapsedMs / goalMs) : 0;
  const reached = active != null && elapsedMs >= goalMs;
  const elapsedHours = elapsedMs / 3600000;
  const lastMilestone = [...MILESTONES].reverse().find((h) => elapsedHours >= h);

  const finish = () => {
    const record = endFast();
    if (!record) return;
    const hours = Math.round(fastHours(record) * 10) / 10;
    showToast(hours >= record.goalHours ? t("fasting.doneGoal", { hours }) : t("fasting.doneShort", { hours }));
  };

  const confirmCancel = () => {
    Alert.alert(t("fasting.cancelConfirm"), undefined, [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("fasting.cancel"), style: "destructive", onPress: cancelFast },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, reached && styles.cardDone]}>
          {active ? (
            <>
              <Text style={styles.big}>{formatDuration(elapsedMs)}</Text>
              <Text style={styles.centerMuted}>
                {reached
                  ? t("fasting.goalReached", { hours: active.goalHours })
                  : t("fasting.remaining", {
                      time: formatDuration(goalMs - elapsedMs),
                      end: formatClock(new Date(active.start + goalMs), locale),
                    })}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }, reached && styles.fillDone]} />
              </View>
              {lastMilestone ? (
                <Text style={styles.milestone}>{t("fasting.milestone", { hours: lastMilestone })}</Text>
              ) : null}
              <Text style={styles.centerMuted}>
                {t("fasting.startedAt", { time: formatClock(new Date(active.start), locale) })}
              </Text>
              <View style={styles.chipRow}>
                <Chip label={t("fasting.earlier", { minutes: 30 })} onPress={() => adjustStart(-30)} />
                <Chip label={t("fasting.earlier", { minutes: 60 })} onPress={() => adjustStart(-60)} />
              </View>
              <View style={styles.buttonGap}>
                <PrimaryButton label={t("fasting.end")} onPress={finish} />
              </View>
              <AnimatedPressable style={styles.cancel} pressScale={0.95} onPress={confirmCancel}>
                <Text style={styles.cancelText}>{t("fasting.cancel")}</Text>
              </AnimatedPressable>
            </>
          ) : (
            <>
              <Text style={[styles.title, { textAlign }]}>{t("fasting.chooseGoal")}</Text>
              <View style={styles.chipRow}>
                {GOALS.map((g) => (
                  <Chip key={g} label={t("fasting.hoursOption", { hours: g })} selected={goal === g} onPress={() => setGoal(g)} />
                ))}
              </View>
              <Text style={[styles.muted, { textAlign }]}>{t("fasting.ramadanHint")}</Text>
              <View style={styles.buttonGap}>
                <PrimaryButton label={t("fasting.start", { hours: goal })} onPress={() => startFast(goal)} />
              </View>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.streakDays}</Text>
            <Text style={styles.statLabel}>{t("fasting.streak")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>{t("fasting.completed")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.averageHours}h</Text>
            <Text style={styles.statLabel}>{t("fasting.average")}</Text>
          </View>
        </View>

        {history.length > 0 ? (
          <>
            <Text style={[styles.section, { textAlign }]}>{t("fasting.history")}</Text>
            {history.slice(0, HISTORY_SHOWN).map((f) => {
              const hours = fastHours(f);
              return (
                <View key={f.start} style={styles.historyRow}>
                  <Text style={[styles.historyText, { textAlign }]}>
                    {hours >= f.goalHours ? "✅" : "⏹"}{" "}
                    {t("fasting.historyLine", {
                      date: new Date(f.end).toISOString().slice(0, 10),
                      hours: Math.round(hours * 10) / 10,
                      goal: f.goalHours,
                    })}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={[styles.disclaimer, { textAlign }]}>{t("fasting.disclaimer")}</Text>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("diary.title")} variant="outline" onPress={() => navigation.navigate("FoodDiary")} />
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
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2.5),
    },
    cardDone: { borderColor: colors.success },
    title: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing(1) },
    big: { fontSize: 52, fontWeight: "900", color: colors.primaryDark, textAlign: "center", fontVariant: ["tabular-nums"] },
    centerMuted: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing(0.5) },
    muted: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1), lineHeight: 18 },
    track: { height: 12, borderRadius: 6, backgroundColor: colors.chipBackground, overflow: "hidden", marginVertical: spacing(1.5) },
    fill: { height: "100%", borderRadius: 6, backgroundColor: colors.primary },
    fillDone: { backgroundColor: colors.success },
    milestone: { fontSize: 14, fontWeight: "800", color: colors.secondary, textAlign: "center" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), justifyContent: "center", marginTop: spacing(1) },
    buttonGap: { marginTop: spacing(1.5) },
    cancel: { alignSelf: "center", marginTop: spacing(1.5) },
    cancelText: { color: colors.danger, fontWeight: "700" },
    statsRow: { flexDirection: "row", gap: spacing(1), marginTop: spacing(1.5) },
    stat: { flex: 1, backgroundColor: colors.chipBackground, borderRadius: radius.md, paddingVertical: spacing(1.5), alignItems: "center" },
    statValue: { fontSize: 20, fontWeight: "900", color: colors.primaryDark },
    statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    section: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: spacing(2.5), marginBottom: spacing(1) },
    historyRow: { paddingVertical: spacing(1), borderBottomWidth: 1, borderBottomColor: colors.border },
    historyText: { fontSize: 14, color: colors.text },
    disclaimer: { fontSize: 11, color: colors.textMuted, marginTop: spacing(2), lineHeight: 16 },
  });
