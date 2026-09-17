import React, { useCallback, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { fetchShoppingListHistory } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { colors, radius, spacing } from "../theme";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Lists">,
  NativeStackScreenProps<RootStackParamList>
>;

type HistoryItem = Awaited<ReturnType<typeof fetchShoppingListHistory>>[number];

export function ListsScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { t } = useLocale();
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

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t("lists.signInTitle")}</Text>
          <Text style={styles.emptySubtitle}>{t("lists.signInSubtitle")}</Text>
          <View style={styles.emptyButton}>
            <PrimaryButton label={t("lists.goToProfile")} onPress={() => navigation.navigate("Main", { screen: "Profile" })} />
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
        ListHeaderComponent={<Text style={styles.headline}>{t("lists.headline")}</Text>}
        ListEmptyComponent={!loading ? <Text style={styles.emptySubtitle}>{t("lists.empty")}</Text> : null}
        renderItem={({ item }) => (
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
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(3) },
  headline: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing(2) },
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
  rowBody: { flex: 1, marginLeft: spacing(1.5) },
  rowTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(4) },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  emptySubtitle: { color: colors.textMuted, textAlign: "center", marginTop: spacing(1), lineHeight: 20 },
  emptyButton: { marginTop: spacing(3), width: "100%" },
});
