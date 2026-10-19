import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisineStats, fetchCuisines } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { useCookStreak } from "../context/CookStreakContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { radius, spacing, type ThemeColors } from "../theme";
import type { Cuisine, CuisineStats } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "CuisineExplorer">;

export function CuisineExplorerScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cuisinesCooked } = useCookStreak();
  const [cuisines, setCuisines] = useState<Cuisine[] | null>(null);
  const [untriedOnly, setUntriedOnly] = useState(false);
  const [stats, setStats] = useState<Record<string, CuisineStats>>({});
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchCuisines()
      .then(setCuisines)
      .catch(() => setCuisines([]));
    fetchCuisineStats()
      .then((list) => setStats(Object.fromEntries(list.map((s) => [s.slug, s]))))
      .catch(() => {});
  }, [locale]);

  if (cuisines === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const cooked = new Set(cuisinesCooked);
  const triedCount = cuisines.filter((c) => cooked.has(c.slug)).length;
  const shown = (untriedOnly ? cuisines.filter((c) => !cooked.has(c.slug)) : cuisines)
    .slice()
    .sort((a, b) => b.recipeCount - a.recipeCount);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.slug}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={[styles.progress, { textAlign }]}>
              {t("cuisineExplorer.progress", { tried: triedCount, total: cuisines.length })}
            </Text>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${cuisines.length ? (triedCount / cuisines.length) * 100 : 0}%` }]}
              />
            </View>
            <View style={styles.chipRow}>
              <Chip label={t("cuisineExplorer.all")} selected={!untriedOnly} onPress={() => setUntriedOnly(false)} />
              <Chip label={t("cuisineExplorer.untried")} selected={untriedOnly} onPress={() => setUntriedOnly(true)} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const tried = cooked.has(item.slug);
          return (
            <AnimatedPressable
              style={[styles.card, tried && styles.cardTried]}
              pressScale={0.96}
              onPress={() => navigation.navigate("RecipeList", { cuisineSlug: item.slug, title: item.name })}
            >
              <Text style={styles.emoji}>{CUISINE_EMOJI[item.slug] ?? "🍽️"}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>{t("cuisineExplorer.recipeCount", { count: item.recipeCount })}</Text>
              {stats[item.slug] ? (
                <Text style={styles.meta}>
                  {t("cuisineExplorer.averages", {
                    cost: Math.round(stats[item.slug].avgCostPerServing),
                    kcal: stats[item.slug].avgCalories,
                    minutes: stats[item.slug].avgMinutes,
                  })}
                </Text>
              ) : null}
              {tried ? <Text style={styles.triedBadge}>{t("cuisineExplorer.tried")}</Text> : null}
            </AnimatedPressable>
          );
        }}
        ListEmptyComponent={<Text style={[styles.meta, { textAlign }]}>{t("cuisineExplorer.allTried")}</Text>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    progress: { fontSize: 15, fontWeight: "800", color: colors.text },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.chipBackground, overflow: "hidden", marginVertical: spacing(1) },
    fill: { height: "100%", backgroundColor: colors.success, borderRadius: 4 },
    chipRow: { flexDirection: "row", gap: spacing(1), marginBottom: spacing(1.5) },
    columns: { gap: spacing(1.5) },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      alignItems: "center",
      marginBottom: spacing(1.5),
    },
    cardTried: { borderColor: colors.success },
    emoji: { fontSize: 34 },
    name: { fontSize: 14, fontWeight: "800", color: colors.text, marginTop: spacing(0.5) },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    triedBadge: { fontSize: 11, fontWeight: "800", color: colors.success, marginTop: spacing(0.5) },
  });
