import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

type Props = {
  visible: boolean;
  streak: number;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onDismiss: () => void;
};

const PARTICLES = ["🎉", "🔥", "✨", "🎊", "⭐"];

/** A celebratory pop-in shown when a cooking streak hits a milestone (3, 7, 14, 30... days). */
export function StreakCelebration({ visible, streak, title, subtitle, buttonLabel, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    particleAnims.forEach((v) => v.setValue(0));
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
    Animated.stagger(
      70,
      particleAnims.map((v) => Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }))
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.particleRow}>
            {PARTICLES.map((p, i) => {
              const anim = particleAnims[i];
              const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
              const translateX = (i - (PARTICLES.length - 1) / 2) * 6;
              const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] });
              return (
                <Animated.Text
                  key={p + i}
                  style={[styles.particle, { transform: [{ translateY }, { translateX }], opacity }]}
                >
                  {p}
                </Animated.Text>
              );
            })}
          </View>
          <Text style={styles.streakNumber}>🔥 {streak}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <AnimatedPressable style={styles.button} pressScale={0.96} onPress={onDismiss}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    card: {
      width: "80%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing(3),
      alignItems: "center",
      ...shadow.floating,
    },
    particleRow: { flexDirection: "row", height: 30 },
    particle: { fontSize: 20, marginHorizontal: 2 },
    streakNumber: { fontSize: 34, fontWeight: "800", color: colors.primary, marginTop: spacing(1) },
    title: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing(1), textAlign: "center" },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: spacing(0.75),
      textAlign: "center",
      lineHeight: 18,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(4),
      paddingVertical: spacing(1.25),
      marginTop: spacing(2.5),
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
