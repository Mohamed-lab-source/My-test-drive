import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { useCollections } from "../context/CollectionsContext";
import { deleteShoppingList, fetchShoppingListHistory } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
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
type Segment = "favorites" | "collections" | "shoppingLists";

export function ListsScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { favoriteRecipes, isLoading: favoritesLoading, toggleFavorite, refresh: refreshFavorites } = useFavorites();
  const { collections, isLoading: collectionsLoading, create: createCollection, remove: removeCollection, refresh: refreshCollections } =
    useCollections();
  const [refreshingFavorites, setRefreshingFavorites] = useState(false);
  const [refreshingCollections, setRefreshingCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const { t } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [segment, setSegment] = useState<Segment>("favorites");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [favSort, setFavSort] = useState<"recent" | "az">("recent");

  const sortedFavorites = useMemo(() => {
    if (favSort === "az") return [...favoriteRecipes].sort((a, b) => a.title.localeCompare(b.title));
    return favoriteRecipes;
  }, [favoriteRecipes, favSort]);

  const removeShoppingList = (id: string) => {
    Alert.alert(t("lists.deleteListConfirmTitle"), t("lists.deleteListConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      {
        text: t("lists.deleteList"),
        style: "destructive",
        onPress: () => {
          setHistory((prev) => prev.filter((h) => h.id !== id));
          deleteShoppingList(id).catch(() => {
            fetchShoppingListHistory().then(setHistory).catch(() => {});
          });
        },
      },
    ]);
  };

  const clearAllFavorites = () => {
    Alert.alert(t("lists.clearFavoritesConfirmTitle"), t("lists.clearFavoritesConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      {
        text: t("lists.clearFavorites"),
        style: "destructive",
        onPress: () => {
          favoriteRecipes.forEach((r) => toggleFavorite(r));
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      setLoading(true);
      fetchShoppingListHistory()
        .then(setHistory)
        .finally(() => setLoading(false));
    }, [isAuthenticated])
  );

  const onRefreshFavorites = () => {
    setRefreshingFavorites(true);
    refreshFavorites().finally(() => setRefreshingFavorites(false));
  };

  const onRefreshHistory = () => {
    setLoading(true);
    fetchShoppingListHistory()
      .then(setHistory)
      .finally(() => setLoading(false));
  };

  const onRefreshCollections = () => {
    setRefreshingCollections(true);
    refreshCollections().finally(() => setRefreshingCollections(false));
  };

  const handleCreateCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    setNewCollectionName("");
    createCollection(name).catch(() => {});
  };

  const handleDeleteCollection = (id: string) => {
    Alert.alert(t("collections.deleteConfirmTitle"), t("collections.deleteConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("collections.delete"), style: "destructive", onPress: () => removeCollection(id).catch(() => {}) },
    ]);
  };

  const monthSpending = useMemo(() => {
    const now = new Date();
    const total = history
      .filter((h) => {
        const d = new Date(h.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, h) => sum + h.totalEstimatedCost, 0);
    return Math.round(total * 100) / 100;
  }, [history]);

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
          style={[styles.segment, segment === "collections" && styles.segmentActive]}
          pressScale={0.97}
          onPress={() => setSegment("collections")}
        >
          <Text style={[styles.segmentText, segment === "collections" && styles.segmentTextActive]}>
            {t("collections.tab")}
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
          data={sortedFavorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {header}
              {favoriteRecipes.length > 0 ? (
                <View style={styles.favControlsRow}>
                  <View style={styles.favSortRow}>
                    <Chip label={t("lists.sortRecent")} selected={favSort === "recent"} onPress={() => setFavSort("recent")} />
                    <Chip label={t("lists.sortAZ")} selected={favSort === "az"} onPress={() => setFavSort("az")} />
                  </View>
                  <AnimatedPressable pressScale={0.92} onPress={clearAllFavorites}>
                    <Text style={styles.clearFavoritesLink}>{t("lists.clearFavorites")}</Text>
                  </AnimatedPressable>
                </View>
              ) : null}
            </View>
          }
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
          refreshControl={<RefreshControl refreshing={refreshingFavorites} onRefresh={onRefreshFavorites} />}
        />
      </SafeAreaView>
    );
  }

  if (segment === "collections") {
    if (!isAuthenticated) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            {header}
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t("collections.signInTitle")}</Text>
              <Text style={styles.emptySubtitle}>{t("collections.signInSubtitle")}</Text>
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
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {header}
              <View style={styles.newCollectionRow}>
                <TextInput
                  style={styles.newCollectionInput}
                  placeholder={t("collections.newPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={newCollectionName}
                  onChangeText={setNewCollectionName}
                  onSubmitEditing={handleCreateCollection}
                  autoCorrect={false}
                />
                <AnimatedPressable
                  style={[styles.newCollectionButton, !newCollectionName.trim() && styles.newCollectionButtonDisabled]}
                  pressScale={0.92}
                  onPress={handleCreateCollection}
                  disabled={!newCollectionName.trim()}
                >
                  <Text style={styles.newCollectionButtonText}>{t("collections.create")}</Text>
                </AnimatedPressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            !collectionsLoading ? <Text style={styles.emptySubtitle}>{t("collections.empty")}</Text> : null
          }
          refreshControl={<RefreshControl refreshing={refreshingCollections} onRefresh={onRefreshCollections} />}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <AnimatedPressable
                style={styles.row}
                pressScale={0.98}
                onPress={() => navigation.navigate("CollectionDetail", { id: item.id })}
              >
                <View style={styles.thumb}>
                  <Text style={styles.thumbEmoji}>📁</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{t("collections.recipeCount", { count: item.recipes.length })}</Text>
                </View>
                <AnimatedPressable
                  style={styles.deleteListButton}
                  pressScale={0.85}
                  onPress={() => handleDeleteCollection(item.id)}
                  accessibilityLabel={t("collections.delete")}
                >
                  <Text style={styles.deleteListIcon}>✕</Text>
                </AnimatedPressable>
              </AnimatedPressable>
            </FadeSlideIn>
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
            {history.length > 0 ? (
              <View style={styles.spendingBanner}>
                <Text style={styles.spendingLabel}>{t("lists.spendingThisMonth")}</Text>
                <Text style={styles.spendingValue}>{t("lists.spendingAmount", { amount: monthSpending })}</Text>
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>{t("lists.headline")}</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.emptySubtitle}>{t("lists.empty")}</Text> : null}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefreshHistory} />}
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index}>
            <AnimatedPressable
              style={styles.row}
              pressScale={0.98}
              onPress={() => navigation.navigate("ShoppingListDetail", { id: item.id })}
            >
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
              <AnimatedPressable
                style={styles.deleteListButton}
                pressScale={0.85}
                onPress={() => removeShoppingList(item.id)}
                accessibilityLabel={t("lists.deleteList")}
              >
                <Text style={styles.deleteListIcon}>✕</Text>
              </AnimatedPressable>
            </AnimatedPressable>
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
  favControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing(1.5),
  },
  favSortRow: { flexDirection: "row" },
  clearFavoritesLink: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  newCollectionRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginBottom: spacing(2) },
  newCollectionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.1),
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  newCollectionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1.25),
  },
  newCollectionButtonDisabled: { opacity: 0.5 },
  newCollectionButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing(2) },
  spendingBanner: {
    backgroundColor: colors.chipBackground,
    borderRadius: radius.md,
    padding: spacing(2),
    marginBottom: spacing(2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spendingLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  spendingValue: { fontSize: 16, fontWeight: "800", color: colors.primaryDark },
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
  deleteListButton: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
    marginStart: spacing(1),
  },
  deleteListIcon: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(4) },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  emptySubtitle: { color: colors.textMuted, textAlign: "center", marginTop: spacing(1), lineHeight: 20 },
  emptyButton: { marginTop: spacing(3), width: "100%" },
});
