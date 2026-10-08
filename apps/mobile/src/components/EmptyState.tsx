import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { spacing, type ThemeColors } from "../theme";

type Props = {
  /** Emoji shown above the message -- defaults to a plate for generic "nothing here yet" states. */
  icon?: string;
  message: string;
};

/**
 * Standard empty-list placeholder: a large emoji over a muted message.
 * Used everywhere a list, search, or detail screen has nothing to show,
 * so every empty state in the app looks and reads the same way.
 */
export function EmptyState({ icon = "🍽️", message }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { alignItems: "center", paddingVertical: spacing(4), paddingHorizontal: spacing(3) },
    icon: { fontSize: 36, marginBottom: spacing(1) },
    message: { textAlign: "center", color: colors.textMuted },
  });
