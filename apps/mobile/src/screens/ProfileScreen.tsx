import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import { fetchCuisines } from "../api/endpoints";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { spacing, type ThemeColors } from "../theme";
import type { Cuisine, DietGoal } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { user, isAuthenticated, logout, savePreferences } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { colors, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);

  const GOALS: { value: DietGoal; label: string }[] = [
    { value: "FIT", label: t("onboarding.goal.fit") },
    { value: "INDULGENT", label: t("onboarding.goal.indulgent") },
    { value: "BALANCED", label: t("onboarding.goal.balanced") },
    { value: "NONE", label: t("onboarding.goal.none") },
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

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.loggedOut}>
          <Text style={styles.headline}>{t("profile.saveTitle")}</Text>
          <Text style={styles.subtitle}>{t("profile.saveSubtitle")}</Text>
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  const dietGoal = user.preference?.dietGoal ?? "NONE";
  const favoriteCuisineSlugs = user.preference?.favoriteCuisineSlugs ?? [];

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>{user.name}</Text>
        <Text style={styles.subtitle}>{user.email}</Text>

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

        <Text style={styles.section}>{t("profile.appearance")}</Text>
        {themeSwitcher}

        <Text style={styles.section}>{t("profile.language")}</Text>
        {languageSwitcher}

        {saving ? <Text style={styles.saving}>{t("profile.saving")}</Text> : null}

        <View style={styles.logoutButton}>
          <PrimaryButton label={t("profile.logout")} variant="outline" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
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
    chipRow: { flexDirection: "row", flexWrap: "wrap" },
    saving: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
    logoutButton: { marginTop: spacing(5) },
    loggedOut: { flexGrow: 1, padding: spacing(3), justifyContent: "center" },
    buttonSpacing: { marginTop: spacing(2) },
  });
