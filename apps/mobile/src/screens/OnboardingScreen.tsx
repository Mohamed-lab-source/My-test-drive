import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import type { DietGoal } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const GOALS: { value: DietGoal; label: string; blurb: string }[] = [
  { value: "FIT", label: "Fit & healthy", blurb: "Lighter, high-protein recipes" },
  { value: "INDULGENT", label: "Feeling a dessert", blurb: "Sweet treats first" },
  { value: "BALANCED", label: "Balanced", blurb: "A bit of everything" },
  { value: "NONE", label: "No preference", blurb: "Show me everything" },
];

const CUISINES = [
  { slug: "italian", name: "Italian" },
  { slug: "asian", name: "Asian" },
  { slug: "egyptian", name: "Egyptian" },
];

export function OnboardingScreen({ navigation }: Props) {
  const { setPreference } = useLocalPreference();
  const [dietGoal, setDietGoal] = useState<DietGoal>("NONE");
  const [cuisines, setCuisines] = useState<string[]>([]);

  const toggleCuisine = (slug: string) => {
    setCuisines((prev) => (prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]));
  };

  const finish = async () => {
    await setPreference({ dietGoal, favoriteCuisineSlugs: cuisines, onboarded: true });
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Welcome to</Text>
        <Text style={styles.title}>Cookmate</Text>
        <Text style={styles.subtitle}>
          Tell us what you're in the mood for so we can recommend the right recipes.
        </Text>

        <Text style={styles.section}>What are you after right now?</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((goal) => (
            <View key={goal.value} style={styles.goalItem}>
              <Chip label={goal.label} selected={dietGoal === goal.value} onPress={() => setDietGoal(goal.value)} />
            </View>
          ))}
        </View>

        <Text style={styles.section}>Favorite cuisines</Text>
        <View style={styles.row}>
          {CUISINES.map((c) => (
            <Chip key={c.slug} label={c.name} selected={cuisines.includes(c.slug)} onPress={() => toggleCuisine(c.slug)} />
          ))}
        </View>

        <View style={styles.footer}>
          <PrimaryButton label="Let's cook" onPress={finish} />
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
