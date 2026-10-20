import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisines } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { PrimaryButton } from "../components/PrimaryButton";
import { useCookStreak } from "../context/CookStreakContext";
import { useCookingJournal } from "../context/CookingJournalContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { radius, spacing, type ThemeColors } from "../theme";
import type { Cuisine } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "CuisinePassport">;

export function CuisinePassportScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cuisinesCooked } = useCookStreak();
  const { entries } = useCookingJournal();
  const [cuisines, setCuisines] = useState<Cuisine[] | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchCuisines()
      .then(setCuisines)
      .catch(() => setCuisines([]));
  }, [locale]);

  // Earliest journal date per cuisine (entries are newest first).
  const firstCooked = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.cuisineSlug, e.finishedAt.slice(0, 10));
    return map;
  }, [entries]);

  if (cuisines === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const stamped = new Set(cuisinesCooked);
  const ordered = [...cuisines].sort((a, b) => Number(stamped.has(b.slug)) - Number(stamped.has(a.slug)));
  const stampCount = cuisines.filter((c) => stamped.has(c.slug)).length;

  const share = () => {
    const names = cuisines
      .filter((c) => stamped.has(c.slug))
      .map((c) => `${CUISINE_EMOJI[c.slug] ?? "🍽️"} ${c.name}`)
      .join(", ");
    Share.share({
      message: [t("passport.shareTitle", { count: stampCount, total: cuisines.length }), names, "", t("share.branding")].join("\n"),
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={ordered}
        keyExtractor={(c) => c.slug}
        numColumns={3}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🛂</Text>
            <Text style={styles.headerTitle}>{t("passport.stamps", { count: stampCount, total: cuisines.length })}</Text>
            <Text style={[styles.muted, { textAlign: "center" }]}>{t("passport.subtitle")}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <PrimaryButton label={t("passport.share")} variant="outline" onPress={share} disabled={stampCount === 0} />
          </View>
        }
        renderItem={({ item, index }) => {
          const has = stamped.has(item.slug);
          const date = firstCooked.get(item.slug);
          return (
            <AnimatedPressable
              style={[
                styles.stamp,
                has ? styles.stampOn : styles.stampOff,
                has && { transform: [{ rotate: `${(index % 3) * 4 - 4}deg` }] },
              ]}
              pressScale={0.95}
              onPress={() => navigation.navigate("RecipeList", { cuisineSlug: item.slug, title: item.name })}
            >
              <Text style={[styles.stampEmoji, !has && styles.faded]}>{CUISINE_EMOJI[item.slug] ?? "🍽️"}</Text>
              <Text style={[styles.stampName, !has && styles.fadedText, { textAlign: "center" }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.stampDate, { textAlign }]}>
                {has ? date ?? t("passport.stamped") : t("passport.notYet")}
              </Text>
            </AnimatedPressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    header: { alignItems: "center", marginBottom: spacing(2) },
    headerEmoji: { fontSize: 44 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing(0.5) },
    muted: { fontSize: 12, color: colors.textMuted, marginTop: spacing(0.5), lineHeight: 18 },
    columns: { gap: spacing(1) },
    stamp: {
      flex: 1,
      alignItems: "center",
      borderRadius: radius.md,
      paddingVertical: spacing(1.25),
      paddingHorizontal: spacing(0.5),
      marginBottom: spacing(1),
      borderWidth: 2,
    },
    stampOn: { borderColor: colors.primary, backgroundColor: colors.chipBackground },
    stampOff: { borderColor: colors.border, borderStyle: "dashed", backgroundColor: colors.surface },
    stampEmoji: { fontSize: 28 },
    faded: { opacity: 0.3 },
    stampName: { fontSize: 12, fontWeight: "800", color: colors.primaryDark, marginTop: 4 },
    fadedText: { color: colors.textMuted },
    stampDate: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    footer: { marginTop: spacing(1) },
  });
