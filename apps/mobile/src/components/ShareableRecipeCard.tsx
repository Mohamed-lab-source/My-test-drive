import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { colors, radius, spacing } from "../theme";
import type { RecipeDetail } from "../api/types";

type Props = {
  recipe: RecipeDetail;
  servings: number;
  ingredients: { name: string; quantity: number; unit: string }[];
  ingredientsLabel: string;
  stepsLabel: string;
  servesLabel: string;
  brandingLabel: string;
  isRTL: boolean;
};

// Rendered off-screen (see RecipeDetailScreen) and captured to a PNG for
// sharing to WhatsApp/Instagram/etc — this is never shown directly on screen.
export const ShareableRecipeCard = forwardRef<View, Props>(
  ({ recipe, servings, ingredients, ingredientsLabel, stepsLabel, servesLabel, brandingLabel, isRTL }, ref) => {
    const textAlign = isRTL ? "right" : "left";
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.emoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.cuisine.name} · {servesLabel}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{ingredientsLabel}</Text>
        {ingredients.map((ing) => (
          <Text key={ing.name} style={[styles.line, { textAlign }]}>
            {isRTL ? `${ing.quantity} ${ing.unit} — ${ing.name} •` : `• ${ing.name} — ${ing.quantity} ${ing.unit}`}
          </Text>
        ))}

        <Text style={[styles.sectionTitle, { textAlign }]}>{stepsLabel}</Text>
        {recipe.steps.map((step) => (
          <Text key={step.order} style={[styles.line, { textAlign }]}>
            {step.order}. {step.instruction}
          </Text>
        ))}

        <Text style={styles.branding}>🍳 {brandingLabel}</Text>
      </View>
    );
  }
);

const CARD_WIDTH = 380;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.background,
    padding: spacing(3),
    borderRadius: radius.md,
  },
  header: { alignItems: "center", marginBottom: spacing(2) },
  emoji: { fontSize: 56, marginBottom: spacing(1) },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
    marginTop: spacing(2.5),
    marginBottom: spacing(1),
  },
  line: { fontSize: 13, color: colors.text, marginBottom: spacing(0.75), lineHeight: 18 },
  branding: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing(3),
  },
});
