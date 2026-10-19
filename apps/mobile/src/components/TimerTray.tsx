import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { formatTimer, useKitchenTimers } from "../context/KitchenTimersContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

/** Every running, paused or finished kitchen timer, each with its own controls. */
export function TimerTray({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const { timers, remainingSec, pause, resume, addMinute, dismiss } = useKitchenTimers();

  if (timers.length === 0) return null;

  return (
    <View style={styles.tray}>
      {timers.map((timer) => {
        const running = timer.endsAt != null;
        return (
          <View key={timer.id} style={[styles.timer, timer.done && styles.timerDone]}>
            <View style={styles.info}>
              <Text style={[styles.time, timer.done && styles.doneText]}>
                {timer.done ? t("cookMode.timeUp") : formatTimer(remainingSec(timer))}
              </Text>
              <Text style={[styles.label, timer.done && styles.doneText]} numberOfLines={1}>
                {timer.label}
              </Text>
            </View>
            {!timer.done ? (
              <AnimatedPressable
                style={styles.button}
                pressScale={0.9}
                onPress={() => (running ? pause(timer.id) : resume(timer.id))}
                accessibilityLabel={running ? t("cookMode.pause") : t("cookMode.start")}
              >
                <Text style={styles.buttonText}>{running ? "⏸" : "▶"}</Text>
              </AnimatedPressable>
            ) : null}
            <AnimatedPressable
              style={styles.button}
              pressScale={0.9}
              onPress={() => addMinute(timer.id)}
              accessibilityLabel={t("timers.addMinute")}
            >
              <Text style={styles.buttonText}>+1</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.button}
              pressScale={0.9}
              onPress={() => dismiss(timer.id)}
              accessibilityLabel={t("timers.dismiss")}
            >
              <Text style={styles.buttonText}>✕</Text>
            </AnimatedPressable>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors, compact: boolean) =>
  StyleSheet.create({
    tray: { gap: spacing(0.75), paddingHorizontal: compact ? spacing(2) : 0, paddingTop: compact ? spacing(1) : 0 },
    timer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      paddingVertical: compact ? spacing(0.75) : spacing(1.25),
      paddingHorizontal: spacing(1.25),
      gap: spacing(0.75),
    },
    timerDone: { backgroundColor: colors.success },
    info: { flex: 1 },
    time: {
      fontSize: compact ? 18 : 26,
      fontWeight: "800",
      color: colors.primaryDark,
      fontVariant: ["tabular-nums"],
    },
    label: { fontSize: 12, color: colors.textMuted },
    doneText: { color: "#fff" },
    button: {
      minWidth: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing(0.75),
    },
    buttonText: { fontSize: 13, fontWeight: "800", color: colors.primaryDark },
  });
