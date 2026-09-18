import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { FadeSlideIn } from "./FadeSlideIn";
import { StarRating } from "./StarRating";
import { useTheme } from "../theme/ThemeContext";
import { useFavorites } from "../context/FavoritesContext";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { radius, spacing, type ThemeColors } from "../theme";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { intersectAllergens } from "../utils/allergens";
import type { TranslationKey } from "../i18n/translations";
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
  const { t } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const favorited = isFavorite(recipe.slug);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const conflictingAllergens = intersectAllergens(recipe.allergens, user?.preference?.allergies ?? []);
  return (
    <FadeSlideIn index={index}>
      <AnimatedPressable style={styles.card} onPress={onPress} pressScale={0.98} accessibilityRole="button">
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
          <AnimatedPressable
            style={styles.favoriteButton}
            pressScale={0.85}
            haptic
            onPress={() => toggleFavorite(recipe)}
          >
            <Text style={styles.favoriteIcon}>{favorited ? "❤️" : "🤍"}</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text style={styles.meta}>
            {recipe.cuisine.name} · {recipe.dishType} · {totalMinutes} min
          </Text>
          <Text style={styles.costText}>
            {t("recipeCard.costPerServing", { cost: Math.round(recipe.costPerServing) })}
          </Text>
          {recipe.avgRating !== null ? (
            <View style={styles.ratingRow}>
              <StarRating value={recipe.avgRating} size={12} />
              <Text style={styles.ratingText}>
                {recipe.avgRating.toFixed(1)} ({recipe.ratingCount})
              </Text>
            </View>
          ) : null}
          {conflictingAllergens.length > 0 ? (
            <Text style={styles.allergenWarning} numberOfLines={1}>
              {t("recipeCard.allergenWarning", {
                allergens: conflictingAllergens.map((a) => t(`allergen.${a}` as TranslationKey)).join(", "),
              })}
            </Text>
          ) : null}
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
    favoriteButton: {
      position: "absolute",
      top: spacing(1),
      end: spacing(1),
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteIcon: { fontSize: 15 },
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
    costText: {
      fontSize: 11,
      color: colors.secondary,
      fontWeight: "600",
      marginTop: 4,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    ratingText: {
      fontSize: 11,
      color: colors.textMuted,
      marginStart: 4,
    },
    allergenWarning: {
      fontSize: 11,
      color: colors.danger,
      fontWeight: "700",
      marginTop: 4,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
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
