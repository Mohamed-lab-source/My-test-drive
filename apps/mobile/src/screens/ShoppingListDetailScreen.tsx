import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchShoppingListDetail } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { usePantryCheck } from "../context/PantryCheckContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { formatQuantity } from "../utils/units";
import { radius, spacing, type ThemeColors } from "../theme";
import type { ShoppingListDetail } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "ShoppingListDetail">;

export function ShoppingListDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isChecked, toggle: toggleHaveAlready } = usePantryCheck();
  const [list, setList] = useState<ShoppingListDetail | null>(null);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchShoppingListDetail(id).then(setList).catch(() => setList(null));
  }, [id]);

  useEffect(() => {
    if (list) navigation.setOptions({ title: list.recipe.title });
  }, [list, navigation]);

  if (!list) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AnimatedPressable
          style={styles.recipeLink}
          pressScale={0.98}
          onPress={() => navigation.navigate("RecipeDetail", { slug: list.recipe.slug })}
        >
          <Text style={styles.recipeLinkText}>{list.recipe.title}</Text>
        </AnimatedPressable>

        <View style={[styles.budgetBanner, { backgroundColor: list.withinBudget ? "#E6F3EA" : "#FBEAEA" }]}>
          <Text style={[styles.budgetTotal, { color: list.withinBudget ? colors.success : colors.danger }]}>
            {t("shoppingList.estimatedTotal", { amount: list.totalEstimatedCost.toFixed(2) })}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>
          {t("shoppingList.listTitle", { count: list.servings })}
        </Text>
        {list.items.map((item, i) => {
          const have = isChecked(item.ingredientName);
          return (
            <FadeSlideIn key={item.id} index={i}>
              <AnimatedPressable
                style={styles.itemRow}
                pressScale={0.99}
                onPress={() => toggleHaveAlready(item.ingredientName)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: have }}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.checkbox, have && styles.checkboxChecked]}>
                    {have ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.itemName, have && styles.itemNameChecked]}>{item.ingredientName}</Text>
                </View>
                <Text style={[styles.itemQty, have && styles.itemNameChecked]}>
                  {formatQuantity(item.quantity, item.unit, unitSystem)}
                </Text>
              </AnimatedPressable>
            </FadeSlideIn>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    loadingSafe: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    recipeLink: { marginBottom: spacing(2) },
    recipeLinkText: { fontSize: 20, fontWeight: "800", color: colors.primaryDark },
    budgetBanner: { borderRadius: radius.md, padding: spacing(2), marginBottom: spacing(2) },
    budgetTotal: { fontSize: 17, fontWeight: "800" },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing(1) },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginEnd: spacing(1.25),
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "800" },
    itemName: { color: colors.text, fontSize: 14, flex: 1 },
    itemNameChecked: { color: colors.textMuted, textDecorationLine: "line-through" },
    itemQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  });
