import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchDeliveryPartners, fetchNearbyStores, fetchRecipeDetail, fetchRecipes } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useMealPlan } from "../context/MealPlanContext";
import { useUnits } from "../context/UnitsContext";
import { formatQuantity } from "../utils/units";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { radius, spacing, type ThemeColors } from "../theme";
import type { DeliveryPartner, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "MealPlanner">;

const DAYS_AHEAD = 7;
const DEBOUNCE_MS = 350;

function dateKeyFor(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

type AggregatedItem = { name: string; quantity: number; unit: string };

export function MealPlannerScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { plan, setPlan } = useMealPlan();
  const textAlign = isRTL ? "right" : "left";

  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aggregated, setAggregated] = useState<AggregatedItem[] | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [haveAlready, setHaveAlready] = useState<Set<string>>(new Set());

  const toggleHaveAlready = (key: string) => {
    setHaveAlready((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetchDeliveryPartners().then(setDeliveryPartners).catch(() => {});
  }, []);

  const handleShareList = async () => {
    if (!aggregated) return;
    const lines = aggregated.map((item) => `- ${item.name}: ${formatQuantity(item.quantity, item.unit, unitSystem)}`);
    const message = [
      t("mealPlanner.combinedListTitle"),
      "",
      ...lines,
      "",
      t("mealPlanner.estimatedTotal", { amount: totalCost }),
    ].join("\n");
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share failed silently; nothing to recover.
    }
  };

  const findNearbyStores = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        const { mapsSearchUrl } = await fetchNearbyStores();
        setMapsUrl(mapsSearchUrl);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { mapsSearchUrl } = await fetchNearbyStores(position.coords.latitude, position.coords.longitude);
      setMapsUrl(mapsSearchUrl);
    } catch (error) {
      Alert.alert(t("shoppingList.errorLocation"), apiErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const weekdayLabel = (offset: number, dateKey: string) => {
    if (offset === 0) return t("mealPlanner.today");
    if (offset === 1) return t("mealPlanner.tomorrow");
    const day = new Date(dateKey + "T00:00:00").getDay();
    return t(`weekday.${day}` as TranslationKey);
  };

  const runSearch = (text: string) => {
    setQuery(text);
    const q = text.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    setTimeout(() => {
      fetchRecipes({ q })
        .then(setResults)
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
  };

  const openPicker = (dateKey: string) => {
    setPickerDate(dateKey);
    setQuery("");
    setResults([]);
  };

  const pick = (recipe: RecipeSummary) => {
    if (pickerDate) setPlan(pickerDate, recipe);
    setPickerDate(null);
  };

  const visibleDateKeys = Array.from({ length: DAYS_AHEAD }, (_, offset) => dateKeyFor(offset));
  const plannedEntries = visibleDateKeys
    .map((dateKey) => [dateKey, plan[dateKey]] as const)
    .filter((entry): entry is [string, RecipeSummary] => Boolean(entry[1]));

  const weeklyNutrition =
    plannedEntries.length > 0
      ? {
          daysPlanned: plannedEntries.length,
          avgCalories: Math.round(
            plannedEntries.reduce((sum, [, r]) => sum + r.caloriesPerServing, 0) / plannedEntries.length
          ),
          avgProtein:
            Math.round(
              (plannedEntries.reduce((sum, [, r]) => sum + r.proteinPerServing, 0) / plannedEntries.length) * 10
            ) / 10,
        }
      : null;

  const generateShoppingList = async () => {
    if (plannedEntries.length === 0) return;
    setGenerating(true);
    try {
      const uniqueSlugs = Array.from(new Set(plannedEntries.map(([, r]) => r.slug)));
      const details = await Promise.all(uniqueSlugs.map((slug) => fetchRecipeDetail(slug)));
      const detailBySlug = new Map(details.map((d) => [d.slug, d]));

      const totals = new Map<string, AggregatedItem>();
      let cost = 0;
      for (const [, recipe] of plannedEntries) {
        const detail = detailBySlug.get(recipe.slug);
        if (!detail) continue;
        cost += detail.costPerServing * detail.baseServings;
        for (const ing of detail.ingredients) {
          const key = `${ing.name}|${ing.unit}`;
          const existing = totals.get(key);
          if (existing) {
            existing.quantity += ing.quantity;
          } else {
            totals.set(key, { name: ing.name, quantity: ing.quantity, unit: ing.unit });
          }
        }
      }
      setAggregated(Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setTotalCost(Math.round(cost * 100) / 100);
      setHaveAlready(new Set());
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { textAlign }]}>{t("mealPlanner.subtitle")}</Text>

        {weeklyNutrition ? (
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionStat}>
              <Text style={styles.nutritionValue}>
                {weeklyNutrition.daysPlanned}/{DAYS_AHEAD}
              </Text>
              <Text style={styles.nutritionLabel}>{t("mealPlanner.daysPlanned")}</Text>
            </View>
            <View style={styles.nutritionStat}>
              <Text style={styles.nutritionValue}>{weeklyNutrition.avgCalories}</Text>
              <Text style={styles.nutritionLabel}>{t("mealPlanner.avgCalories")}</Text>
            </View>
            <View style={styles.nutritionStat}>
              <Text style={styles.nutritionValue}>{weeklyNutrition.avgProtein}g</Text>
              <Text style={styles.nutritionLabel}>{t("mealPlanner.avgProtein")}</Text>
            </View>
          </View>
        ) : null}

        {Array.from({ length: DAYS_AHEAD }).map((_, offset) => {
          const dateKey = dateKeyFor(offset);
          const recipe = plan[dateKey];
          return (
            <FadeSlideIn key={dateKey} index={offset}>
              <View style={styles.dayRow}>
                <Text style={[styles.dayLabel, { textAlign }]}>{weekdayLabel(offset, dateKey)}</Text>
                {recipe ? (
                  <View style={styles.plannedCard}>
                    <AnimatedPressable
                      style={styles.plannedCardMain}
                      pressScale={0.98}
                      onPress={() => navigation.navigate("RecipeDetail", { slug: recipe.slug })}
                    >
                      <Text style={styles.plannedEmoji}>{CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"}</Text>
                      <Text style={styles.plannedTitle} numberOfLines={1}>
                        {recipe.title}
                      </Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={styles.removeButton}
                      pressScale={0.85}
                      onPress={() => setPlan(dateKey, null)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </AnimatedPressable>
                  </View>
                ) : (
                  <AnimatedPressable
                    style={styles.addCard}
                    pressScale={0.97}
                    onPress={() => openPicker(dateKey)}
                  >
                    <Text style={styles.addCardText}>{t("mealPlanner.addRecipe")}</Text>
                  </AnimatedPressable>
                )}
              </View>
            </FadeSlideIn>
          );
        })}

        <View style={styles.generateButton}>
          <PrimaryButton
            label={t("mealPlanner.generateShoppingList")}
            onPress={generateShoppingList}
            loading={generating}
            disabled={plannedEntries.length === 0}
          />
        </View>

        {aggregated ? (
          <FadeSlideIn style={styles.resultSection}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t("mealPlanner.combinedListTitle")}
            </Text>
            <Text style={styles.totalCost}>{t("mealPlanner.estimatedTotal", { amount: totalCost })}</Text>
            <Text style={[styles.pantryHint, { textAlign }]}>{t("shoppingList.pantryHint")}</Text>
            {aggregated.map((item) => {
              const key = `${item.name}|${item.unit}`;
              const have = haveAlready.has(key);
              return (
                <AnimatedPressable
                  key={key}
                  style={styles.itemRow}
                  pressScale={0.99}
                  onPress={() => toggleHaveAlready(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: have }}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.checkbox, have && styles.checkboxChecked]}>
                      {have ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.itemName, have && styles.itemNameChecked]}>{item.name}</Text>
                  </View>
                  <Text style={[styles.itemQty, have && styles.itemNameChecked]}>
                    {formatQuantity(item.quantity, item.unit, unitSystem)}
                  </Text>
                </AnimatedPressable>
              );
            })}

            <Text style={[styles.sectionTitle, { textAlign }]}>{t("shoppingList.getIngredients")}</Text>
            <View style={styles.partnerRow}>
              {deliveryPartners.map((partner) => (
                <AnimatedPressable
                  key={partner.id}
                  style={styles.partnerCard}
                  pressScale={0.94}
                  onPress={() => Linking.openURL(partner.websiteUrl)}
                >
                  <Text style={styles.partnerEmoji}>{partner.logoEmoji}</Text>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                </AnimatedPressable>
              ))}
            </View>

            <View style={styles.nearbyButton}>
              <PrimaryButton
                label={t("shoppingList.findNearby")}
                variant="outline"
                onPress={findNearbyStores}
                loading={locating}
              />
            </View>
            {mapsUrl ? (
              <Pressable onPress={() => Linking.openURL(mapsUrl)}>
                <Text style={styles.mapsLink}>{t("shoppingList.openMaps")}</Text>
              </Pressable>
            ) : null}
            <View style={styles.shareButton}>
              <PrimaryButton label={t("shoppingList.share")} variant="outline" onPress={handleShareList} />
            </View>
          </FadeSlideIn>
        ) : null}
      </ScrollView>

      <Modal visible={pickerDate !== null} animationType="slide" transparent onRequestClose={() => setPickerDate(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { textAlign }]}>{t("mealPlanner.pickerTitle")}</Text>
            <TextInput
              style={[styles.searchInput, { textAlign }]}
              placeholder={t("search.placeholder")}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={runSearch}
              autoFocus
              autoCorrect={false}
            />
            {searching ? (
              <ActivityIndicator color={colors.primary} style={styles.pickerSpinner} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <AnimatedPressable style={styles.pickerRow} pressScale={0.98} onPress={() => pick(item)}>
                    <Text style={styles.plannedEmoji}>{CUISINE_EMOJI[item.cuisine.slug] ?? "🍽️"}</Text>
                    <Text style={styles.pickerRowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </AnimatedPressable>
                )}
              />
            )}
            <AnimatedPressable style={styles.modalClose} pressScale={0.96} onPress={() => setPickerDate(null)}>
              <Text style={styles.modalCloseText}>{t("cookMode.close")}</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, marginBottom: spacing(2), lineHeight: 20 },
    nutritionRow: {
      flexDirection: "row",
      backgroundColor: colors.chipBackground,
      borderRadius: 14,
      paddingVertical: spacing(1.5),
      marginBottom: spacing(2.5),
    },
    nutritionStat: { flex: 1, alignItems: "center" },
    nutritionValue: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    nutritionLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    dayRow: { marginBottom: spacing(1.5) },
    dayLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: spacing(0.5) },
    plannedCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
    },
    plannedCardMain: { flex: 1, flexDirection: "row", alignItems: "center" },
    plannedEmoji: { fontSize: 22, marginEnd: spacing(1.5) },
    plannedTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    removeButton: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginStart: spacing(1),
    },
    removeButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
    addCard: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      padding: spacing(1.75),
      alignItems: "center",
    },
    addCardText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
    generateButton: { marginTop: spacing(2) },
    resultSection: { marginTop: spacing(3) },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing(0.5) },
    totalCost: { color: colors.primaryDark, fontWeight: "700", marginBottom: spacing(1.5) },
    pantryHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1) },
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
    partnerRow: { flexDirection: "row" },
    partnerCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      paddingVertical: spacing(2),
      marginEnd: spacing(1),
    },
    partnerEmoji: { fontSize: 26 },
    partnerName: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 4 },
    nearbyButton: { marginTop: spacing(2) },
    shareButton: { marginTop: spacing(1.5) },
    mapsLink: { color: colors.primary, fontWeight: "700", textAlign: "center", marginTop: spacing(1.5) },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopStartRadius: radius.lg,
      borderTopEndRadius: radius.lg,
      padding: spacing(3),
      maxHeight: "80%",
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing(1.5) },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 15,
      marginBottom: spacing(1.5),
    },
    pickerSpinner: { marginTop: spacing(3) },
    pickerList: { marginBottom: spacing(1.5) },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing(1.25),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerRowTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
    modalClose: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    modalCloseText: { color: colors.primaryDark, fontWeight: "700" },
  });
