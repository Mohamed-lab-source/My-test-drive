import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipeDetail } from "../api/endpoints";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, radius, spacing } from "../theme";
import type { RecipeDetail } from "../api/types";

const CUISINE_EMOJI: Record<string, string> = {
  italian: "🍝",
  asian: "🍜",
  egyptian: "🍲",
};

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(1);

  useEffect(() => {
    fetchRecipeDetail(slug)
      .then((data) => {
        setRecipe(data);
        setServings(data.baseServings);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const scale = servings / recipe.baseServings;
    return recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: round2(ing.quantity * scale),
    }));
  }, [recipe, servings]);

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
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
        </View>
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

          <Text style={styles.sectionTitle}>How many people are eating?</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              accessibilityRole="button"
              accessibilityLabel="Fewer people"
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{servings}</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setServings((s) => Math.min(50, s + 1))}
              accessibilityRole="button"
              accessibilityLabel="More people"
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Ingredients (for {servings})</Text>
          {scaledIngredients.map((ing) => (
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
              initialServings: servings,
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
  hero: {
    width: "100%",
    height: 200,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 72 },
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
  stepperRow: { flexDirection: "row", alignItems: "center" },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 20, fontWeight: "800", color: colors.primaryDark },
  stepperValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginHorizontal: spacing(3) },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
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
