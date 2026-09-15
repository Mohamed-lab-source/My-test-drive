import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipeDetail } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, radius, spacing } from "../theme";
import type { RecipeDetail } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipeDetail(slug)
      .then(setRecipe)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView>
        <Image source={{ uri: recipe.heroImageUrl }} style={styles.hero} />
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.description}>{recipe.description}</Text>

          <View style={styles.metaRow}>
            <MetaPill label={`${recipe.cuisine.name}`} />
            <MetaPill label={recipe.dishType} />
            <MetaPill label={`${totalMinutes} min`} />
            <MetaPill label={recipe.difficulty} />
            <MetaPill label={`Serves ${recipe.baseServings}`} />
          </View>

          <Text style={styles.sectionTitle}>Ingredients (for {recipe.baseServings})</Text>
          {recipe.ingredients.map((ing) => (
            <View key={ing.name} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Steps</Text>
          {recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepCard}>
              <Image source={{ uri: step.imageUrl }} style={styles.stepImage} />
              <View style={styles.stepBody}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.order}</Text>
                  </View>
                  {step.timerMinutes ? (
                    <Text style={styles.stepTimer}>⏱ {step.timerMinutes} min</Text>
                  ) : null}
                </View>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label="Plan shopping list"
          onPress={() =>
            navigation.navigate("ShoppingList", {
              slug: recipe.slug,
              title: recipe.title,
              baseServings: recipe.baseServings,
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingSafe: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 240, backgroundColor: colors.chipBackground },
  content: { padding: spacing(3), paddingBottom: spacing(2) },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  description: { color: colors.textMuted, marginTop: spacing(1), lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing(2) },
  metaPill: {
    backgroundColor: colors.chipBackground,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 6,
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  metaPillText: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1.5) },
  ingredientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientName: { color: colors.text, fontSize: 14 },
  ingredientQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepImage: { width: "100%", height: 160, backgroundColor: colors.chipBackground },
  stepBody: { padding: spacing(1.5) },
  stepHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepTimer: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  stepInstruction: { color: colors.text, marginTop: spacing(1), lineHeight: 20 },
  footer: {
    padding: spacing(2),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
