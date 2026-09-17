import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchNearbyStores, generateShoppingList } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { colors, radius, spacing } from "../theme";
import type { ShoppingListResult } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "ShoppingList">;

export function ShoppingListScreen({ route, navigation }: Props) {
  const { slug, title, baseServings, initialServings } = route.params;
  const { t, isRTL } = useLocale();
  const [servings, setServings] = useState(initialServings ?? baseServings);
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShoppingListResult | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: t("shoppingList.title") });
  }, [navigation, t]);

  const generate = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const parsedBudget = budget.trim() ? Number(budget) : undefined;
      const data = await generateShoppingList(slug, servings, parsedBudget);
      setResult(data);
    } catch (error) {
      Alert.alert(t("shoppingList.errorGenerate"), apiErrorMessage(error));
    } finally {
      setLoading(false);
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
      const { mapsSearchUrl } = await fetchNearbyStores(
        position.coords.latitude,
        position.coords.longitude
      );
      setMapsUrl(mapsSearchUrl);
    } catch (error) {
      Alert.alert(t("shoppingList.errorLocation"), apiErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { textAlign }]}>{title}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("shoppingList.subtitle")}</Text>

        <Text style={[styles.label, { textAlign }]}>{t("shoppingList.servings")}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setServings((s) => Math.max(1, s - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{servings}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setServings((s) => Math.min(50, s + 1))}>
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("shoppingList.budgetLabel")}</Text>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("shoppingList.budgetPlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={budget}
          onChangeText={setBudget}
        />

        <View style={styles.generateButton}>
          <PrimaryButton label={t("shoppingList.generate")} onPress={generate} loading={loading} />
        </View>

        {result ? (
          <View style={styles.resultSection}>
            <View
              style={[
                styles.budgetBanner,
                { backgroundColor: result.withinBudget ? "#E6F3EA" : "#FBEAEA" },
              ]}
            >
              <Text style={[styles.budgetTotal, { color: result.withinBudget ? colors.success : colors.danger }]}>
                {t("shoppingList.estimatedTotal", { amount: result.totalEstimatedCost.toFixed(2) })}
              </Text>
              {result.budget !== null && (
                <Text style={styles.budgetSub}>
                  {result.withinBudget
                    ? t("shoppingList.underBudget", {
                        diff: result.budgetDifference?.toFixed(2) ?? "0",
                        budget: result.budget,
                      })
                    : t("shoppingList.overBudget", {
                        diff: Math.abs(result.budgetDifference ?? 0).toFixed(2),
                        budget: result.budget,
                      })}
                </Text>
              )}
            </View>

            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t("shoppingList.listTitle", { count: result.servings })}
            </Text>
            {result.items.map((item) => (
              <View key={item.ingredientName} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.ingredientName}</Text>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemCost}>{item.estimatedCost.toFixed(2)} EGP</Text>
                </View>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { textAlign }]}>{t("shoppingList.getIngredients")}</Text>
            <View style={styles.partnerRow}>
              {result.deliveryPartners.map((partner) => (
                <Pressable
                  key={partner.id}
                  style={styles.partnerCard}
                  onPress={() => Linking.openURL(partner.websiteUrl)}
                >
                  <Text style={styles.partnerEmoji}>{partner.logoEmoji}</Text>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                </Pressable>
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
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing(1), lineHeight: 20 },
  label: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  generateButton: { marginTop: spacing(4) },
  resultSection: { marginTop: spacing(4) },
  budgetBanner: { borderRadius: radius.md, padding: spacing(2) },
  budgetTotal: { fontSize: 17, fontWeight: "800" },
  budgetSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: 14, flex: 1 },
  itemRight: { alignItems: "flex-end" },
  itemQty: { color: colors.textMuted, fontSize: 13 },
  itemCost: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  partnerRow: { flexDirection: "row" },
  partnerCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: spacing(2),
    marginRight: spacing(1),
  },
  partnerEmoji: { fontSize: 26 },
  partnerName: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 4 },
  nearbyButton: { marginTop: spacing(2) },
  mapsLink: { color: colors.primary, fontWeight: "700", textAlign: "center", marginTop: spacing(1.5) },
});
