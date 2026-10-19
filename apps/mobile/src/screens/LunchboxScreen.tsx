import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { RecipeCard } from "../components/RecipeCard";
import { EmptyState } from "../components/EmptyState";
import { useHousehold } from "../context/HouseholdContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { isLunchboxFriendly } from "../utils/kidFriendly";
import { spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Lunchbox">;

export function LunchboxScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { members } = useHousehold();
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchRecipes({})
      .then(setRecipes)
      .catch(() => setRecipes([]));
  }, [locale]);

  const familyAllergens = new Set(members.flatMap((m) => m.allergies));
  const ideas = (recipes ?? [])
    .filter((r) => isLunchboxFriendly(r) && !r.allergens.some((a) => familyAllergens.has(a)))
    .sort((a, b) => a.prepMinutes + a.cookMinutes - (b.prepMinutes + b.cookMinutes));

  if (recipes === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={ideas}
        keyExtractor={(r) => r.slug}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={[styles.subtitle, { textAlign }]}>{t("lunchbox.subtitle")}</Text>
            {familyAllergens.size > 0 ? (
              <Text style={[styles.note, { textAlign }]}>{t("lunchbox.allergySafe")}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="🍱" message={t("lunchbox.empty")} />}
        renderItem={({ item, index }) => (
          <RecipeCard
            recipe={item}
            index={index}
            onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(1) },
    note: { color: colors.success, fontWeight: "700", fontSize: 12, marginBottom: spacing(1.5) },
  });
