import React, { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { EmptyState } from "../components/EmptyState";
import { useHiddenRecipes } from "../context/HiddenRecipesContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "HiddenRecipes">;

export function HiddenRecipesScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { hidden, unhide } = useHiddenRecipes();
  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={hidden}
        keyExtractor={(h) => h.slug}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={[styles.subtitle, { textAlign }]}>{t("hidden.subtitle")}</Text>}
        ListEmptyComponent={<EmptyState icon="🙈" message={t("hidden.empty")} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <AnimatedPressable
              style={styles.flex1}
              pressScale={0.98}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            >
              <Text style={[styles.title, { textAlign }]}>
                {CUISINE_EMOJI[item.cuisineSlug] ?? "🍽️"} {item.title}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable pressScale={0.9} onPress={() => unhide(item.slug)} accessibilityRole="button">
              <Text style={styles.link}>{t("hidden.unhide")}</Text>
            </AnimatedPressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(1.5) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    flex1: { flex: 1 },
    title: { fontSize: 15, color: colors.text, fontWeight: "600" },
    link: { color: colors.primary, fontWeight: "700", marginStart: spacing(1.5) },
  });
