import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { formatQuantity } from "../utils/units";
import { inferEquipment } from "../utils/miseEnPlace";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MiseEnPlace">;

export function MiseEnPlaceScreen({ route, navigation }: Props) {
  const { slug, title, cuisineSlug, steps, ingredients, servings, myRating } = route.params;
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";
  const [gathered, setGathered] = useState<Set<string>>(new Set());

  const equipment = useMemo(() => inferEquipment(steps.map((s) => s.instruction)), [steps]);

  const toggleGathered = (name: string) => {
    setGathered((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startCooking = () => {
    navigation.replace("CookMode", { slug, title, cuisineSlug, steps, ingredients, servings, myRating });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { textAlign }]}>{t("miseEnPlace.subtitle")}</Text>

        {equipment.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { textAlign }]}>{t("miseEnPlace.equipmentTitle")}</Text>
            <View style={styles.equipmentRow}>
              {equipment.map((item) => (
                <View key={item.id} style={styles.equipmentChip}>
                  <Text style={styles.equipmentEmoji}>{item.emoji}</Text>
                  <Text style={styles.equipmentLabel}>{t(item.labelKey)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("miseEnPlace.ingredientsTitle")}</Text>
        {ingredients.map((ing, i) => {
          const have = gathered.has(ing.name);
          return (
            <FadeSlideIn key={ing.name} index={i}>
              <AnimatedPressable
                style={styles.itemRow}
                pressScale={0.99}
                onPress={() => toggleGathered(ing.name)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: have }}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.checkbox, have && styles.checkboxChecked]}>
                    {have ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.itemName, have && styles.itemNameChecked]}>{ing.name}</Text>
                </View>
                <Text style={[styles.itemQty, have && styles.itemNameChecked]}>
                  {formatQuantity(ing.quantity, ing.unit, unitSystem)}
                </Text>
              </AnimatedPressable>
            </FadeSlideIn>
          );
        })}

        <View style={styles.startButton}>
          <PrimaryButton label={t("miseEnPlace.startCooking")} onPress={startCooking} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, marginBottom: spacing(2), lineHeight: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(2), marginBottom: spacing(1) },
    equipmentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    equipmentChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.85),
    },
    equipmentEmoji: { fontSize: 16, marginEnd: 6 },
    equipmentLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
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
    itemQty: { color: colors.textMuted, fontSize: 13 },
    startButton: { marginTop: spacing(3) },
  });
