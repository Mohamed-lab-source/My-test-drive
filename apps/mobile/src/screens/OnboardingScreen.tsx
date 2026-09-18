import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { useLocale } from "../i18n/LocaleContext";
import { fetchCuisines } from "../api/endpoints";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useTheme } from "../theme/ThemeContext";
import { spacing, type ThemeColors } from "../theme";
import type { Cuisine, DietGoal } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  const { setPreference } = useLocalPreference();
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dietGoal, setDietGoal] = useState<DietGoal>("NONE");
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const GOALS: { value: DietGoal; label: string; blurb: string }[] = [
    { value: "NONE", label: t("onboarding.goal.none"), blurb: t("onboarding.goal.none.blurb") },
    { value: "LOSE_WEIGHT", label: t("onboarding.goal.loseWeight"), blurb: t("onboarding.goal.loseWeight.blurb") },
    { value: "BUILD_MUSCLE", label: t("onboarding.goal.buildMuscle"), blurb: t("onboarding.goal.buildMuscle.blurb") },
    { value: "GAIN_WEIGHT", label: t("onboarding.goal.gainWeight"), blurb: t("onboarding.goal.gainWeight.blurb") },
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
        <Text style={[styles.goalBlurb, { textAlign }]}>
          {GOALS.find((g) => g.value === dietGoal)?.blurb}
        </Text>

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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingTop: spacing(6) },
    eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    title: { color: colors.primary, fontSize: 34, fontWeight: "800", marginTop: 4 },
    subtitle: { color: colors.textMuted, fontSize: 15, marginTop: spacing(1.5), lineHeight: 21 },
    section: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(4), marginBottom: spacing(1.5) },
    goalGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    goalItem: { marginEnd: spacing(1) },
    goalBlurb: { color: colors.textMuted, fontSize: 13, marginTop: spacing(1) },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    footer: { marginTop: spacing(5) },
  });
