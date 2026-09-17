import React, { useCallback, useMemo, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { fetchShoppingListHistory } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { RecipeCard } from "../components/RecipeCard";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Lists">,
  NativeStackScreenProps<RootStackParamList>
>;

type HistoryItem = Awaited<ReturnType<typeof fetchShoppingListHistory>>[number];
type Segment = "favorites" | "shoppingLists";

export function ListsScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { favoriteRecipes, isLoading: favoritesLoading } = useFavorites();
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [segment, setSegment] = useState<Segment>("favorites");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      setLoading(true);
      fetchShoppingListHistory()
        .then(setHistory)
        .finally(() => setLoading(false));
    }, [isAuthenticated])
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.headline}>{t("tabs.lists")}</Text>
      <View style={styles.segmentedControl}>
        <AnimatedPressable
          style={[styles.segment, segment === "favorites" && styles.segmentActive]}
          pressScale={0.97}
          onPress={() => setSegment("favorites")}
        >
          <Text style={[styles.segmentText, segment === "favorites" && styles.segmentTextActive]}>
            {t("lists.favoritesTab")}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.segment, segment === "shoppingLists" && styles.segmentActive]}
          pressScale={0.97}
          onPress={() => setSegment("shoppingLists")}
        >
          <Text style={[styles.segmentText, segment === "shoppingLists" && styles.segmentTextActive]}>
            {t("lists.shoppingListsTab")}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );

  if (segment === "favorites") {
    return (
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={favoriteRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !favoritesLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t("lists.favoritesEmptyTitle")}</Text>
                <Text style={styles.emptySubtitle}>{t("lists.favoritesEmptySubtitle")}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <RecipeCard recipe={item} index={index} onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })} />
          )}
        />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {header}
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t("lists.signInTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("lists.signInSubtitle")}</Text>
            <View style={styles.emptyButton}>
              <PrimaryButton label={t("lists.goToProfile")} onPress={() => navigation.navigate("Main", { screen: "Profile" })} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {header}
            <Text style={styles.sectionTitle}>{t("lists.headline")}</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.emptySubtitle}>{t("lists.empty")}</Text> : null}
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index}>
            <View style={styles.row}>
              <View style={styles.thumb}>
                <Text style={styles.thumbEmoji}>🍽️</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.recipe.title}</Text>
                <Text style={styles.rowMeta}>
                  {t("lists.rowMeta", { servings: item.servings, cost: item.totalEstimatedCost.toFixed(2) })}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.withinBudget ? colors.success : colors.danger },
                ]}
              />
            </View>
          </FadeSlideIn>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing(3) },
  listContent: { padding: spacing(3), flexGrow: 1 },
  header: { marginBottom: spacing(1) },
  headline: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: spacing(1), marginBottom: spacing(2) },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.chipBackground,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing(2),
  },
  segment: {
    flex: 1,
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  segmentTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing(2) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmoji: { fontSize: 24 },
  rowBody: { flex: 1, marginStart: spacing(1.5) },
  rowTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(4) },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  emptySubtitle: { color: colors.textMuted, textAlign: "center", marginTop: spacing(1), lineHeight: 20 },
  emptyButton: { marginTop: spacing(3), width: "100%" },
});
