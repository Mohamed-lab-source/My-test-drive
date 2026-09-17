import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <AnimatedPressable
      onPress={onPress}
      pressScale={0.93}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      paddingVertical: spacing(1),
      paddingHorizontal: spacing(2),
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      marginEnd: spacing(1),
      marginBottom: spacing(1),
    },
    chipSelected: {
      backgroundColor: colors.primary,
    },
    label: {
      color: colors.primaryDark,
      fontWeight: "600",
      fontSize: 13,
    },
    labelSelected: {
      color: "#fff",
    },
  });
