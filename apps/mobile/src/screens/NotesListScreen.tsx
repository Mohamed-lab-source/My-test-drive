import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { useNotes } from "../context/NotesContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Notes">;

type NotedRecipe = { recipe: RecipeSummary; note: string };

export function NotesListScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { notes, isLoading: notesLoading } = useNotes();
  const [entries, setEntries] = useState<NotedRecipe[] | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    if (notesLoading) return;
    const slugs = Object.keys(notes);
    if (slugs.length === 0) {
      setEntries([]);
      return;
    }
    fetchRecipes({})
      .then((all) => {
        const bySlug = new Map(all.map((r) => [r.slug, r]));
        const matched = slugs
          .map((slug) => {
            const recipe = bySlug.get(slug);
            return recipe ? { recipe, note: notes[slug] } : null;
          })
          .filter((e): e is NotedRecipe => e !== null);
        setEntries(matched);
      })
      .catch(() => setEntries([]));
  }, [notes, notesLoading, locale]);

  if (entries === null) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.recipe.slug}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index}>
            <AnimatedPressable
              style={styles.card}
              pressScale={0.98}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.recipe.slug })}
            >
              <Text style={styles.emoji}>{CUISINE_EMOJI[item.recipe.cuisine.slug] ?? "🍽️"}</Text>
              <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.recipe.title}
                </Text>
                <Text style={[styles.note, { textAlign }]} numberOfLines={2}>
                  {item.note}
                </Text>
              </View>
            </AnimatedPressable>
          </FadeSlideIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t("notes.empty")}</Text>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    loadingSafe: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    listContent: { padding: spacing(3), paddingTop: spacing(2) },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.75),
      marginBottom: spacing(1.5),
    },
    emoji: { fontSize: 30, marginEnd: spacing(1.75) },
    textCol: { flex: 1 },
    title: { fontSize: 15, fontWeight: "700", color: colors.text },
    note: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(6) },
  });
