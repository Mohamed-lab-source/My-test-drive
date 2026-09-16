import React, { useState } from "react";
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
import { colors, radius, spacing } from "../theme";
import type { ShoppingListResult } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "ShoppingList">;

export function ShoppingListScreen({ route }: Props) {
  const { slug, title, baseServings, initialServings } = route.params;
  const [servings, setServings] = useState(initialServings ?? baseServings);
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShoppingListResult | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const generate = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const parsedBudget = budget.trim() ? Number(budget) : undefined;
      const data = await generateShoppingList(slug, servings, parsedBudget);
      setResult(data);
    } catch (error) {
      Alert.alert("Couldn't build your list", apiErrorMessage(error));
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
      Alert.alert("Couldn't get your location", apiErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Tell us how many people and your budget — we'll do the math.</Text>

        <Text style={styles.label}>Servings</Text>
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

        <Text style={styles.label}>Budget (EGP, optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 150"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={budget}
          onChangeText={setBudget}
        />

        <View style={styles.generateButton}>
          <PrimaryButton label="Generate shopping list" onPress={generate} loading={loading} />
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
                Estimated total: {result.totalEstimatedCost.toFixed(2)} EGP
              </Text>
              {result.budget !== null && (
                <Text style={styles.budgetSub}>
                  {result.withinBudget
                    ? `${result.budgetDifference?.toFixed(2)} EGP under your ${result.budget} EGP budget`
                    : `${Math.abs(result.budgetDifference ?? 0).toFixed(2)} EGP over your ${result.budget} EGP budget`}
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Shopping list ({result.servings} servings)</Text>
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

            <Text style={styles.sectionTitle}>Get the ingredients</Text>
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
                label="Find nearby supermarkets"
                variant="outline"
                onPress={findNearbyStores}
                loading={locating}
              />
            </View>
            {mapsUrl ? (
              <Pressable onPress={() => Linking.openURL(mapsUrl)}>
                <Text style={styles.mapsLink}>Open in Google Maps →</Text>
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
