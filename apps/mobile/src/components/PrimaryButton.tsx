import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
};

export function PrimaryButton({ label, onPress, loading, disabled, variant = "primary" }: Props) {
  const isOutline = variant === "outline";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
