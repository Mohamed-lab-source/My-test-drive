import React, { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { Chip } from "../components/Chip";
import { colors, spacing } from "../theme";
import type { DishTag, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeList">;

const TAG_FILTERS: { value: DishTag | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "FIT", label: "Fit" },
  { value: "DESSERT", label: "Dessert" },
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "QUICK", label: "Quick" },
];

export function RecipeListScreen({ route, navigation }: Props) {
  const { cuisineSlug, tag: initialTag, title } = route.params;
  const [activeTag, setActiveTag] = useState<DishTag | undefined>(initialTag as DishTag | undefined);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    setLoading(true);
    fetchRecipes({ cuisine: cuisineSlug, tag: activeTag })
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [cuisineSlug, activeTag]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.filterRow}>
        {TAG_FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} selected={activeTag === f.value} onPress={() => setActiveTag(f.value)} />
        ))}
      </View>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })} />
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No recipes match these filters yet.</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing(3), paddingTop: spacing(2) },
  listContent: { padding: spacing(3), paddingTop: spacing(1) },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4) },
});
