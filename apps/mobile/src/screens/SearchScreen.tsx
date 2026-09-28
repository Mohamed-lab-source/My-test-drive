import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisines, fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { Chip } from "../components/Chip";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { Cuisine, RecipeSummary } from "../api/types";

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
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [cuisineFilter, setCuisineFilter] = useState<string | undefined>(undefined);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((stored) => {
        if (stored) setRecentSearches(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCuisines().then(setCuisines).catch(() => {});
  }, [locale]);

  const saveSearch = (q: string) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const removeSearch = (q: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== q);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
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
      fetchRecipes({ q, cuisine: cuisineFilter })
        .then((data) => {
          setResults(data);
          setSearched(true);
          saveSearch(q);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locale, cuisineFilter]);

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
      {query.trim() && cuisines.length > 0 ? (
        <View style={styles.cuisineFilterRow}>
          <Chip
            label={t("search.allCuisines")}
            selected={cuisineFilter === undefined}
            onPress={() => setCuisineFilter(undefined)}
          />
          {cuisines.map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              selected={cuisineFilter === c.slug}
              onPress={() => setCuisineFilter((prev) => (prev === c.slug ? undefined : c.slug))}
            />
          ))}
        </View>
      ) : null}
      {!query.trim() && recentSearches.length > 0 ? (
        <View style={styles.recentSearchesWrap}>
          <View style={styles.recentSearchesHeaderRow}>
            <Text style={[styles.recentSearchesLabel, { textAlign }]}>{t("search.recentSearches")}</Text>
            <Pressable onPress={clearSearches}>
              <Text style={styles.clearLink}>{t("search.clearRecent")}</Text>
            </Pressable>
          </View>
          <View style={styles.recentSearchesRow}>
            {recentSearches.map((s) => (
              <Chip key={s} label={s} onPress={() => setQuery(s)} onLongPress={() => removeSearch(s)} />
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
    cuisineFilterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      paddingHorizontal: spacing(3),
      paddingTop: spacing(1),
    },
    recentSearchesWrap: { paddingHorizontal: spacing(3), paddingTop: spacing(1) },
    recentSearchesHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing(1),
    },
    recentSearchesLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 0 },
    clearLink: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
    recentSearchesRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    spinner: { marginTop: spacing(4) },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4) },
  });
