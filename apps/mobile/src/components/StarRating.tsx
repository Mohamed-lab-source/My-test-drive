import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { useTheme } from "../theme/ThemeContext";
import { spacing, type ThemeColors } from "../theme";

type Props = {
  /** Average or selected score, 0-5. Fractional values round to the nearest star for display. */
  value: number;
  /** When provided, stars become tappable and call this with the tapped star (1-5). */
  onChange?: (score: number) => void;
  size?: number;
};

export function StarRating({ value, onChange, size = 18 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rounded = Math.round(value);
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.row}>
      {stars.map((star) =>
        onChange ? (
          <AnimatedPressable key={star} onPress={() => onChange(star)} pressScale={0.85} haptic>
            <Text style={[styles.star, { fontSize: size }]}>{star <= rounded ? "★" : "☆"}</Text>
          </AnimatedPressable>
        ) : (
          <Text key={star} style={[styles.star, { fontSize: size }]}>
            {star <= rounded ? "★" : "☆"}
          </Text>
        )
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 2 },
    star: { color: colors.primary, marginEnd: 1 },
  });
