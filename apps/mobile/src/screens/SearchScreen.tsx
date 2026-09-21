import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { Chip } from "../components/Chip";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

const DEBOUNCE_MS = 350;
const RECENT_SEARCHES_KEY = "cookmate.recentSearches";
const MAX_RECENT_SEARCHES = 5;

export function SearchScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((stored) => {
        if (stored) setRecentSearches(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const saveSearch = (q: string) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      fetchRecipes({ q })
        .then((data) => {
          setResults(data);
          setSearched(true);
          saveSearch(q);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locale]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, { textAlign }]}
          placeholder={t("search.placeholder")}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
        />
      </View>
      {!query.trim() && recentSearches.length > 0 ? (
        <View style={styles.recentSearchesWrap}>
          <Text style={[styles.recentSearchesLabel, { textAlign }]}>{t("search.recentSearches")}</Text>
          <View style={styles.recentSearchesRow}>
            {recentSearches.map((s) => (
              <Chip key={s} label={s} onPress={() => setQuery(s)} />
            ))}
          </View>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <RecipeCard
              recipe={item}
              index={index}
              onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            />
          )}
          ListEmptyComponent={
            searched ? <Text style={styles.empty}>{t("search.empty")}</Text> : null
          }
        />
      )}
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
    recentSearchesWrap: { paddingHorizontal: spacing(3), paddingTop: spacing(1) },
    recentSearchesLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: spacing(1) },
    recentSearchesRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    spinner: { marginTop: spacing(4) },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4) },
  });
