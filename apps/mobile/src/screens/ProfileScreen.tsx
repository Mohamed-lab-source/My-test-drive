import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useCookStreak } from "../context/CookStreakContext";
import { apiErrorMessage } from "../api/client";
import { fetchCuisines } from "../api/endpoints";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { spacing, type ThemeColors } from "../theme";
import { ALL_ALLERGENS } from "../utils/allergens";
import type { TranslationKey } from "../i18n/translations";
import type { Allergen, Cuisine, DietGoal } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { user, isAuthenticated, logout, savePreferences } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { colors, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { unitSystem, setUnitSystem } = useUnits();
  const { displayStreak, longestStreak, totalCooked } = useCookStreak();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);

  const GOALS: { value: DietGoal; label: string }[] = [
    { value: "NONE", label: t("onboarding.goal.none") },
    { value: "LOSE_WEIGHT", label: t("onboarding.goal.loseWeight") },
    { value: "BUILD_MUSCLE", label: t("onboarding.goal.buildMuscle") },
    { value: "GAIN_WEIGHT", label: t("onboarding.goal.gainWeight") },
  ];

  useEffect(() => {
    fetchCuisines().then(setCuisines).catch(() => {});
  }, [locale]);

  const languageSwitcher = (
    <View style={styles.chipRow}>
      <Chip label="English" selected={locale === "en"} onPress={() => setLocale("en")} />
      <Chip label="العربية" selected={locale === "ar"} onPress={() => setLocale("ar")} />
    </View>
  );

  const themeSwitcher = (
    <View style={styles.chipRow}>
      <Chip label={t("profile.themeLight")} selected={themePreference === "light"} onPress={() => setThemePreference("light")} />
      <Chip label={t("profile.themeDark")} selected={themePreference === "dark"} onPress={() => setThemePreference("dark")} />
      <Chip label={t("profile.themeSystem")} selected={themePreference === "system"} onPress={() => setThemePreference("system")} />
    </View>
  );

  const unitsSwitcher = (
    <View style={styles.chipRow}>
      <Chip label={t("profile.unitsMetric")} selected={unitSystem === "metric"} onPress={() => setUnitSystem("metric")} />
      <Chip label={t("profile.unitsImperial")} selected={unitSystem === "imperial"} onPress={() => setUnitSystem("imperial")} />
    </View>
  );

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.loggedOut}>
          <Text style={styles.headline}>{t("profile.saveTitle")}</Text>
          <Text style={styles.subtitle}>{t("profile.saveSubtitle")}</Text>
          <StreakStats
            displayStreak={displayStreak}
            longestStreak={longestStreak}
            totalCooked={totalCooked}
            t={t}
            styles={styles}
          />
          <View style={styles.buttonSpacing}>
            <PrimaryButton label={t("profile.login")} onPress={() => navigation.navigate("Login")} />
          </View>
          <View style={styles.buttonSpacing}>
            <PrimaryButton label={t("profile.createAccount")} variant="outline" onPress={() => navigation.navigate("Signup")} />
          </View>
          <Text style={[styles.section, styles.languageSection]}>{t("profile.appearance")}</Text>
          {themeSwitcher}
          <Text style={styles.section}>{t("profile.language")}</Text>
          {languageSwitcher}
          <Text style={styles.section}>{t("profile.units")}</Text>
          {unitsSwitcher}
          <View style={styles.buttonSpacing}>
            <PrimaryButton
              label={t("glossary.title")}
              variant="outline"
              onPress={() => navigation.navigate("Glossary")}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const dietGoal = user.preference?.dietGoal ?? "NONE";
  const favoriteCuisineSlugs = user.preference?.favoriteCuisineSlugs ?? [];
  const allergies = user.preference?.allergies ?? [];

  const updateGoal = async (goal: DietGoal) => {
    setSaving(true);
    try {
      await savePreferences({ dietGoal: goal });
    } catch (error) {
      Alert.alert(t("profile.errorSave"), apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleCuisine = async (slug: string) => {
    const next = favoriteCuisineSlugs.includes(slug)
      ? favoriteCuisineSlugs.filter((s) => s !== slug)
      : [...favoriteCuisineSlugs, slug];
    setSaving(true);
    try {
      await savePreferences({ favoriteCuisineSlugs: next });
    } catch (error) {
      Alert.alert(t("profile.errorSave"), apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleAllergy = async (allergen: Allergen) => {
    const next = allergies.includes(allergen)
      ? allergies.filter((a) => a !== allergen)
      : [...allergies, allergen];
    setSaving(true);
    try {
      await savePreferences({ allergies: next });
    } catch (error) {
      Alert.alert(t("profile.errorSave"), apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>{user.name}</Text>
        <Text style={styles.subtitle}>{user.email}</Text>

        <StreakStats
          displayStreak={displayStreak}
          longestStreak={longestStreak}
          totalCooked={totalCooked}
          t={t}
          styles={styles}
        />

        <Text style={styles.section}>{t("profile.dietGoal")}</Text>
        <View style={styles.chipRow}>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={dietGoal === g.value} onPress={() => updateGoal(g.value)} />
          ))}
        </View>

        <Text style={styles.section}>{t("profile.favoriteCuisines")}</Text>
        <View style={styles.chipRow}>
          {cuisines.map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              selected={favoriteCuisineSlugs.includes(c.slug)}
              onPress={() => toggleCuisine(c.slug)}
            />
          ))}
        </View>

        <Text style={styles.section}>{t("profile.allergies")}</Text>
        <View style={styles.chipRow}>
          {ALL_ALLERGENS.map((a) => (
            <Chip
              key={a}
              label={t(`allergen.${a}` as TranslationKey)}
              selected={allergies.includes(a)}
              onPress={() => toggleAllergy(a)}
            />
          ))}
        </View>

        <Text style={styles.section}>{t("profile.appearance")}</Text>
        {themeSwitcher}

        <Text style={styles.section}>{t("profile.language")}</Text>
        {languageSwitcher}

        <Text style={styles.section}>{t("profile.units")}</Text>
        {unitsSwitcher}

        <View style={styles.buttonSpacing}>
          <PrimaryButton
            label={t("glossary.title")}
            variant="outline"
            onPress={() => navigation.navigate("Glossary")}
          />
        </View>

        {saving ? <Text style={styles.saving}>{t("profile.saving")}</Text> : null}

        <View style={styles.logoutButton}>
          <PrimaryButton label={t("profile.logout")} variant="outline" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function StreakStats({
  displayStreak,
  longestStreak,
  totalCooked,
  t,
  styles,
}: {
  displayStreak: number;
  longestStreak: number;
  totalCooked: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  styles: Styles;
}) {
  return (
    <View style={styles.streakRow}>
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>🔥 {displayStreak}</Text>
        <Text style={styles.streakLabel}>{t("profile.streakCurrent")}</Text>
      </View>
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{longestStreak}</Text>
        <Text style={styles.streakLabel}>{t("profile.streakLongest")}</Text>
      </View>
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{totalCooked}</Text>
        <Text style={styles.streakLabel}>{t("profile.streakTotal")}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3) },
    headline: { fontSize: 22, fontWeight: "800", color: colors.text },
    subtitle: { color: colors.textMuted, marginTop: 4 },
    section: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
    languageSection: { marginTop: spacing(4) },
    chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    saving: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
    logoutButton: { marginTop: spacing(5) },
    loggedOut: { flexGrow: 1, padding: spacing(3), justifyContent: "center" },
    buttonSpacing: { marginTop: spacing(2) },
    streakRow: {
      flexDirection: "row",
      backgroundColor: colors.chipBackground,
      borderRadius: 14,
      marginTop: spacing(2.5),
      paddingVertical: spacing(1.5),
    },
    streakStat: { flex: 1, alignItems: "center" },
    streakValue: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    streakLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  });
