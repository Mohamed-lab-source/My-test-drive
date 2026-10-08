import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchIngredients } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { EmptyState } from "../components/EmptyState";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { PantryIngredient } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "SubstitutionFinder">;

export function SubstitutionFinderScreen({}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState<PantryIngredient[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  const loadIngredients = () => {
    setLoadError(false);
    fetchIngredients()
      .then(setIngredients)
      .catch(() => setLoadError(true));
  };

  useEffect(() => {
    loadIngredients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const filtered = useMemo(() => {
    if (!ingredients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return ingredients.filter((i) => i.substitute);
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, { textAlign }]}
          placeholder={t("substitutionFinder.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      {loadError ? (
        <AnimatedPressable style={styles.errorBanner} pressScale={0.98} onPress={loadIngredients}>
          <Text style={styles.errorBannerText}>{t("substitutionFinder.loadError")}</Text>
        </AnimatedPressable>
      ) : null}
      {ingredients === null && !loadError ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : ingredients !== null ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <View style={styles.card}>
                <Text style={[styles.name, { textAlign }]}>{item.name}</Text>
                <Text style={[styles.substitute, { textAlign }]}>
                  {item.substitute ? `→ ${item.substitute}` : t("substitutionFinder.noneFound")}
                </Text>
              </View>
            </FadeSlideIn>
          )}
          ListEmptyComponent={<EmptyState icon="🔄" message={t("substitutionFinder.empty")} />}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: spacing(3), paddingTop: spacing(2), paddingBottom: spacing(1) },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 15,
    },
    spinner: { marginTop: spacing(4) },
    errorBanner: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.sm,
      marginHorizontal: spacing(3),
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      marginBottom: spacing(1),
    },
    errorBannerText: { color: colors.danger, fontSize: 12, fontWeight: "600", textAlign: "center" },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.75),
      marginBottom: spacing(1.5),
    },
    name: { fontSize: 15, fontWeight: "700", color: colors.text },
    substitute: { fontSize: 13, color: colors.primaryDark, marginTop: 4, fontWeight: "600" },
  });
