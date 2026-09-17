import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useLocale } from "../i18n/LocaleContext";
import { fetchCuisines } from "../api/endpoints";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import type { Cuisine, DietGoal } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  const { setPreference } = useLocalPreference();
  const { t, isRTL } = useLocale();
  const [dietGoal, setDietGoal] = useState<DietGoal>("NONE");
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const GOALS: { value: DietGoal; label: string; blurb: string }[] = [
    { value: "FIT", label: t("onboarding.goal.fit"), blurb: t("onboarding.goal.fit.blurb") },
    { value: "INDULGENT", label: t("onboarding.goal.indulgent"), blurb: t("onboarding.goal.indulgent.blurb") },
    { value: "BALANCED", label: t("onboarding.goal.balanced"), blurb: t("onboarding.goal.balanced.blurb") },
    { value: "NONE", label: t("onboarding.goal.none"), blurb: t("onboarding.goal.none.blurb") },
  ];

  useEffect(() => {
    fetchCuisines().then(setCuisines).catch(() => {});
  }, []);

  const toggleCuisine = (slug: string) => {
    setSelectedCuisines((prev) => (prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]));
  };

  const finish = async () => {
    await setPreference({ dietGoal, favoriteCuisineSlugs: selectedCuisines, onboarded: true });
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { textAlign }]}>{t("onboarding.welcomeTo")}</Text>
        <Text style={[styles.title, { textAlign }]}>Cookmate</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("onboarding.subtitle")}</Text>

        <Text style={[styles.section, { textAlign }]}>{t("onboarding.goalQuestion")}</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((goal) => (
            <View key={goal.value} style={styles.goalItem}>
              <Chip label={goal.label} selected={dietGoal === goal.value} onPress={() => setDietGoal(goal.value)} />
            </View>
          ))}
        </View>

        <Text style={[styles.section, { textAlign }]}>{t("onboarding.favoriteCuisines")}</Text>
        <View style={styles.row}>
          {cuisines.map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              selected={selectedCuisines.includes(c.slug)}
              onPress={() => toggleCuisine(c.slug)}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={t("onboarding.cta")} onPress={finish} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3), paddingTop: spacing(6) },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  title: { color: colors.primary, fontSize: 34, fontWeight: "800", marginTop: 4 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: spacing(1.5), lineHeight: 21 },
  section: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(4), marginBottom: spacing(1.5) },
  goalGrid: { flexDirection: "row", flexWrap: "wrap" },
  goalItem: { marginRight: spacing(1) },
  row: { flexDirection: "row", flexWrap: "wrap" },
  footer: { marginTop: spacing(5) },
});
