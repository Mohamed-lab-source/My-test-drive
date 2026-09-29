import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type BlockProps = { style?: StyleProp<ViewStyle> };

/** A single pulsing placeholder rectangle -- the building block for skeleton screens. */
export function SkeletonBlock({ style }: BlockProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.chipBackground, borderRadius: radius.sm, opacity }, style]}
    />
  );
}

/** Mirrors RecipeCard's layout so the real content pops into the exact same shape once it loads. */
export function RecipeCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <SkeletonBlock style={styles.image} />
      <View style={styles.body}>
        <SkeletonBlock style={styles.titleBar} />
        <SkeletonBlock style={styles.metaBar} />
        <SkeletonBlock style={styles.costBar} />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      overflow: "hidden",
      marginBottom: spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
    },
    image: { width: "100%", height: 140, borderRadius: 0 },
    body: { padding: spacing(1.5) },
    titleBar: { height: 16, width: "70%", marginBottom: spacing(1) },
    metaBar: { height: 11, width: "50%", marginBottom: spacing(1) },
    costBar: { height: 11, width: "40%" },
  });
