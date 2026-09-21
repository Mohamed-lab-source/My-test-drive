import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchIngredients, matchPantryRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { RecipeCard } from "../components/RecipeCard";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { PantryIngredient, PantryMatch } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "PantryFinder">;

const DEBOUNCE_MS = 400;

export function PantryFinderScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  const [allIngredients, setAllIngredients] = useState<PantryIngredient[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<PantryMatch[]>([]);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    fetchIngredients().then(setAllIngredients).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setResults([]);
      return;
    }
    setMatching(true);
    const handle = setTimeout(() => {
      matchPantryRecipes(selectedIds)
        .then(setResults)
        .finally(() => setMatching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [selectedIds]);

  const selectedSet = new Set(selectedIds);
  const filteredIngredients = query.trim()
    ? allIngredients.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const toggleIngredient = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedIngredients = allIngredients.filter((i) => selectedSet.has(i.id));

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={[styles.subtitle, { textAlign }]}>{t("pantryFinder.subtitle")}</Text>

            <TextInput
              style={[styles.searchInput, { textAlign }]}
              placeholder={t("pantryFinder.searchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />

            {query.trim() ? (
              <View style={styles.suggestionList}>
                {filteredIngredients.slice(0, 8).map((ing) => (
                  <AnimatedPressable
                    key={ing.id}
                    style={styles.suggestionRow}
                    pressScale={0.98}
                    onPress={() => {
                      toggleIngredient(ing.id);
                      setQuery("");
                    }}
                  >
                    <Text style={styles.suggestionText}>{ing.name}</Text>
                    <Text style={styles.suggestionAdd}>{selectedSet.has(ing.id) ? "✓" : "+"}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            ) : null}

            {selectedIngredients.length > 0 ? (
              <View style={styles.selectedWrap}>
                {selectedIngredients.map((ing) => (
                  <AnimatedPressable
                    key={ing.id}
                    style={styles.selectedChip}
                    pressScale={0.95}
                    onPress={() => toggleIngredient(ing.id)}
                  >
                    <Text style={styles.selectedChipText}>{ing.name} ✕</Text>
                  </AnimatedPressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>{t("pantryFinder.emptyHint")}</Text>
            )}

            {matching ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
            {!matching && results.length > 0 ? (
              <Text style={[styles.resultsTitle, { textAlign }]}>
                {t("pantryFinder.resultsTitle", { count: results.length })}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <RecipeCard
              recipe={item}
              index={index}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            />
            {item.missingIngredientNames.length > 0 ? (
              <FadeSlideIn>
                <Text style={[styles.missingText, { textAlign }]}>
                  {t("pantryFinder.missing", { list: item.missingIngredientNames.join(", ") })}
                </Text>
              </FadeSlideIn>
            ) : (
              <Text style={[styles.missingText, styles.missingTextComplete, { textAlign }]}>
                {t("pantryFinder.haveEverything")}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          !matching && selectedIds.length > 0 ? (
            <Text style={styles.emptyHint}>{t("pantryFinder.noMatches")}</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, marginBottom: spacing(2), lineHeight: 20 },
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
    suggestionList: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing(1),
      overflow: "hidden",
    },
    suggestionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: { color: colors.text, fontSize: 14 },
    suggestionAdd: { color: colors.primary, fontWeight: "800", fontSize: 16 },
    selectedWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      marginTop: spacing(2),
    },
    selectedChip: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      marginEnd: spacing(1),
      marginBottom: spacing(1),
    },
    selectedChipText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
    emptyHint: { color: colors.textMuted, marginTop: spacing(2), textAlign: "center" },
    spinner: { marginTop: spacing(3) },
    resultsTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
    missingText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing(2) },
    missingTextComplete: { color: colors.success, fontWeight: "700" },
  });
