import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
};

export function PrimaryButton({ label, onPress, loading, disabled, variant = "primary" }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isOutline = variant === "outline";
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      pressScale={0.97}
      style={[
        styles.button,
        isOutline ? styles.outline : styles.solid,
        (disabled || loading) && styles.disabled,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : "#fff"} />
      ) : (
        <Text style={isOutline ? styles.outlineText : styles.solidText}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      paddingVertical: spacing(1.75),
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    solid: {
      backgroundColor: colors.primary,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    disabled: {
      opacity: 0.6,
    },
    solidText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    outlineText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 15,
    },
  });
