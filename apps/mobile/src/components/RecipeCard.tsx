import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = {
  recipe: RecipeSummary;
  onPress: () => void;
};

export function RecipeCard({ recipe, onPress }: Props) {
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Image source={{ uri: recipe.heroImageUrl }} style={styles.image} />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: "100%",
    height: 140,
    backgroundColor: colors.chipBackground,
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
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primaryDark,
  },
});
