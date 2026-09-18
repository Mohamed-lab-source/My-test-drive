import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { AnimatedPressable } from "./AnimatedPressable";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import { useLocale } from "../i18n/LocaleContext";

type Props = {
  minutes: number;
  onFinish?: () => void;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StepTimer({ minutes, onFinish }: Props) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalSeconds = Math.round(minutes * 60);
  const [remaining, setRemaining] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    // Reset whenever the underlying step (and thus `minutes`) changes.
    setRemaining(totalSeconds);
    setIsRunning(false);
    setIsDone(false);
  }, [totalSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          setIsDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 400);
          onFinishRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const toggle = () => {
    if (isDone) {
      setRemaining(totalSeconds);
      setIsDone(false);
      setIsRunning(true);
      return;
    }
    setIsRunning((r) => !r);
  };

  const reset = () => {
    setIsRunning(false);
    setIsDone(false);
    setRemaining(totalSeconds);
  };

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <Text style={styles.time}>{isDone ? t("cookMode.timeUp") : formatTime(remaining)}</Text>
      <View style={styles.buttonRow}>
        <AnimatedPressable style={styles.button} pressScale={0.92} onPress={toggle}>
          <Text style={styles.buttonText}>
            {isDone ? t("cookMode.restart") : isRunning ? t("cookMode.pause") : t("cookMode.start")}
          </Text>
        </AnimatedPressable>
        {(isRunning || remaining !== totalSeconds) && !isDone ? (
          <AnimatedPressable style={[styles.button, styles.buttonOutline]} pressScale={0.92} onPress={reset}>
            <Text style={styles.buttonOutlineText}>{t("cookMode.reset")}</Text>
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(2),
      alignItems: "center",
      marginTop: spacing(2),
    },
    cardDone: {
      backgroundColor: colors.success,
    },
    time: { fontSize: 32, fontWeight: "800", color: colors.primaryDark, fontVariant: ["tabular-nums"] },
    buttonRow: { flexDirection: "row", gap: spacing(1), marginTop: spacing(1.5) },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: spacing(1),
      paddingHorizontal: spacing(2.5),
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    buttonOutline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    buttonOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  });
