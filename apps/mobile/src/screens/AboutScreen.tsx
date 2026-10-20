import React, { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchCuisines, fetchRecipes } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { shareViaWhatsApp } from "../utils/whatsapp";
import { APP_DOWNLOAD_URL } from "../data/appInfo";
import { CHANGELOG_ENTRIES } from "../data/changelog";
import appConfig from "../../app.json";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

export function AboutScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [counts, setCounts] = useState<{ recipes: number; cuisines: number } | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    Promise.all([fetchRecipes({}), fetchCuisines()])
      .then(([recipes, cuisines]) => setCounts({ recipes: recipes.length, cuisines: cuisines.length }))
      .catch(() => {});
  }, [locale]);

  const latest = CHANGELOG_ENTRIES[0];

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.name}>Cookmate</Text>
          <Text style={styles.version}>{t("about.version", { version: appConfig.expo.version })}</Text>
          <Text style={[styles.tagline, { textAlign: "center" }]}>{t("about.tagline")}</Text>
        </View>

        {counts ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{counts.recipes}</Text>
              <Text style={styles.statLabel}>{t("about.recipes")}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{counts.cuisines}</Text>
              <Text style={styles.statLabel}>{t("about.cuisines")}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>2</Text>
              <Text style={styles.statLabel}>{t("about.languages")}</Text>
            </View>
          </View>
        ) : null}

        {latest ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign }]}>{t("about.latest", { date: latest.date })}</Text>
            <Text style={[styles.body, { textAlign }]}>{latest.title[locale]}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t("about.privacyTitle")}</Text>
          <Text style={[styles.body, { textAlign }]}>{t("about.privacyBody")}</Text>
        </View>

        <View style={styles.buttonGap}>
          <PrimaryButton
            label={t("about.tour")}
            variant="outline"
            onPress={() => navigation.navigate("FeatureTour", { onFinishGoBack: true })}
          />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("about.whatsNew")} variant="outline" onPress={() => navigation.navigate("WhatsNew")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton
            label={t("household.invite")}
            variant="outline"
            onPress={() => shareViaWhatsApp(t("household.inviteMessage", { url: APP_DOWNLOAD_URL }))}
          />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("about.download")} variant="outline" onPress={() => Linking.openURL(APP_DOWNLOAD_URL)} />
        </View>
        <Text style={[styles.footer, { textAlign: "center" }]}>{t("about.footer")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    hero: { alignItems: "center", marginBottom: spacing(2) },
    logo: { fontSize: 56 },
    name: { fontSize: 26, fontWeight: "900", color: colors.primaryDark, marginTop: spacing(0.5) },
    version: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    tagline: { fontSize: 14, color: colors.text, marginTop: spacing(1), lineHeight: 20 },
    statsRow: { flexDirection: "row", gap: spacing(1), marginBottom: spacing(1.5) },
    stat: {
      flex: 1,
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    statValue: { fontSize: 20, fontWeight: "900", color: colors.primaryDark },
    statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.75),
      marginBottom: spacing(1.5),
    },
    cardTitle: { fontSize: 13, fontWeight: "800", color: colors.textMuted },
    body: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: spacing(0.5) },
    buttonGap: { marginTop: spacing(1.25) },
    footer: { fontSize: 12, color: colors.textMuted, marginTop: spacing(3) },
  });
