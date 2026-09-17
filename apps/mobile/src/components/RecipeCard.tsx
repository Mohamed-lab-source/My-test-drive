import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { FadeSlideIn } from "./FadeSlideIn";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import type { RecipeSummary } from "../api/types";

type Props = {
  recipe: RecipeSummary;
  onPress: () => void;
  /** Position within its list, used to stagger the entrance animation. */
  index?: number;
};

export function RecipeCard({ recipe, onPress, index = 0 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  return (
    <FadeSlideIn index={index}>
      <AnimatedPressable style={styles.card} onPress={onPress} pressScale={0.98} accessibilityRole="button">
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text style={styles.meta}>
            {recipe.cuisine.name} · {recipe.dishType} · {totalMinutes} min
          </Text>
          <View style={styles.tagRow}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </AnimatedPressable>
    </FadeSlideIn>
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
    imagePlaceholder: {
      width: "100%",
      height: 140,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderEmoji: {
      fontSize: 44,
    },
    body: {
      padding: spacing(1.5),
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: spacing(1),
    },
    tagBadge: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1),
      paddingVertical: 2,
      marginEnd: 6,
      marginBottom: 4,
    },
    tagText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primaryDark,
    },
  });
