import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
// Always rendered with the light palette regardless of the app's active theme --
// a shared image should look the same (and stay legible) wherever it lands.
import { lightColors as colors, radius, spacing } from "../theme";

type Props = {
  titleLabel: string;
  brandingLabel: string;
  emptyDayLabel: string;
  days: { label: string; title: string | null; cuisineSlug: string | null }[];
  isRTL: boolean;
};

// Rendered off-screen (see MealPlannerScreen) and captured to a PNG for
// sharing to WhatsApp/Instagram/etc -- this is never shown directly on screen.
export const ShareablePlanCard = forwardRef<View, Props>(
  ({ titleLabel, brandingLabel, emptyDayLabel, days, isRTL }, ref) => {
    const textAlign = isRTL ? "right" : "left";
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <Text style={styles.title}>{titleLabel}</Text>
        {days.map((day, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.emoji}>{day.cuisineSlug ? CUISINE_EMOJI[day.cuisineSlug] ?? "🍽️" : "⬜"}</Text>
            <View style={styles.textCol}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <Text style={[styles.dayTitle, { textAlign }]} numberOfLines={1}>
                {day.title ?? emptyDayLabel}
              </Text>
            </View>
          </View>
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
  title: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing(2) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emoji: { fontSize: 24, marginEnd: spacing(1.5) },
  textCol: { flex: 1 },
  dayLabel: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  dayTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2 },
  branding: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing(3),
  },
});
