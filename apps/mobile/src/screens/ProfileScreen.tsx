import React, { useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import type { DietGoal } from "../api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

const GOALS: { value: DietGoal; label: string }[] = [
  { value: "FIT", label: "Fit & healthy" },
  { value: "INDULGENT", label: "Feeling a dessert" },
  { value: "BALANCED", label: "Balanced" },
  { value: "NONE", label: "No preference" },
];

const CUISINES = [
  { slug: "italian", name: "Italian" },
  { slug: "asian", name: "Asian" },
  { slug: "egyptian", name: "Egyptian" },
];

export function ProfileScreen({ navigation }: Props) {
  const { user, isAuthenticated, logout, savePreferences } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loggedOut}>
          <Text style={styles.headline}>Save your preferences and lists</Text>
          <Text style={styles.subtitle}>Sign in to sync your diet goals and shopping list history.</Text>
          <View style={styles.buttonSpacing}>
            <PrimaryButton label="Log in" onPress={() => navigation.navigate("Login")} />
          </View>
          <View style={styles.buttonSpacing}>
            <PrimaryButton label="Create an account" variant="outline" onPress={() => navigation.navigate("Signup")} />
          </View>
        </View>
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
      Alert.alert("Couldn't save", apiErrorMessage(error));
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
      Alert.alert("Couldn't save", apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>{user.name}</Text>
        <Text style={styles.subtitle}>{user.email}</Text>

        <Text style={styles.section}>Diet goal</Text>
        <View style={styles.row}>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={dietGoal === g.value} onPress={() => updateGoal(g.value)} />
          ))}
        </View>

        <Text style={styles.section}>Favorite cuisines</Text>
        <View style={styles.row}>
          {CUISINES.map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              selected={favoriteCuisineSlugs.includes(c.slug)}
              onPress={() => toggleCuisine(c.slug)}
            />
          ))}
        </View>
        {saving ? <Text style={styles.saving}>Saving…</Text> : null}

        <View style={styles.logoutButton}>
          <PrimaryButton label="Log out" variant="outline" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3) },
  headline: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  section: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
  row: { flexDirection: "row", flexWrap: "wrap" },
  saving: { color: colors.textMuted, fontSize: 12, marginTop: spacing(1) },
  logoutButton: { marginTop: spacing(5) },
  loggedOut: { flex: 1, padding: spacing(3), justifyContent: "center" },
  buttonSpacing: { marginTop: spacing(2) },
});
