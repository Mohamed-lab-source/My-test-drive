import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    borderRadius: radius.pill,
    backgroundColor: colors.chipBackground,
    marginRight: spacing(1),
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
