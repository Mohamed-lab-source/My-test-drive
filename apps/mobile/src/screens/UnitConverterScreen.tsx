import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "UnitConverter">;

type WeightVolumeUnit = "g" | "kg" | "oz" | "lb" | "ml" | "l" | "tsp" | "tbsp" | "cup";

// Grams for weight units, millilitres for volume units -- the two groups never
// convert into each other since that depends on ingredient density.
const UNIT_TO_BASE: Record<WeightVolumeUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
};

const WEIGHT_UNITS: WeightVolumeUnit[] = ["g", "kg", "oz", "lb"];
const VOLUME_UNITS: WeightVolumeUnit[] = ["ml", "l", "tsp", "tbsp", "cup"];

const UNIT_LABEL_KEYS: Record<WeightVolumeUnit, TranslationKey> = {
  g: "converter.unit.g",
  kg: "converter.unit.kg",
  oz: "converter.unit.oz",
  lb: "converter.unit.lb",
  ml: "converter.unit.ml",
  l: "converter.unit.l",
  tsp: "converter.unit.tsp",
  tbsp: "converter.unit.tbsp",
  cup: "converter.unit.cup",
};

function round2(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

export function UnitConverterScreen({}: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  const [amount, setAmount] = useState("1");
  const [fromUnit, setFromUnit] = useState<WeightVolumeUnit>("cup");
  const [toUnit, setToUnit] = useState<WeightVolumeUnit>("ml");

  const [ovenValue, setOvenValue] = useState("180");
  const [ovenFrom, setOvenFrom] = useState<"c" | "f">("c");

  const isFromWeight = WEIGHT_UNITS.includes(fromUnit);
  const compatibleUnits = isFromWeight ? WEIGHT_UNITS : VOLUME_UNITS;

  const result = useMemo(() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return null;
    const base = n * UNIT_TO_BASE[fromUnit];
    return base / UNIT_TO_BASE[toUnit];
  }, [amount, fromUnit, toUnit]);

  const ovenResult = useMemo(() => {
    const n = parseFloat(ovenValue);
    if (Number.isNaN(n)) return null;
    return ovenFrom === "c" ? (n * 9) / 5 + 32 : ((n - 32) * 5) / 9;
  }, [ovenValue, ovenFrom]);

  const selectFromUnit = (unit: WeightVolumeUnit) => {
    setFromUnit(unit);
    const nowWeight = WEIGHT_UNITS.includes(unit);
    const stillCompatible = nowWeight ? WEIGHT_UNITS.includes(toUnit) : VOLUME_UNITS.includes(toUnit);
    if (!stillCompatible) setToUnit(nowWeight ? "g" : "ml");
  };

  const UnitChip = ({
    unit,
    selected,
    onPress,
  }: {
    unit: WeightVolumeUnit;
    selected: boolean;
    onPress: () => void;
  }) => (
    <AnimatedPressable
      style={[styles.unitChip, selected && styles.unitChipSelected]}
      pressScale={0.94}
      onPress={onPress}
    >
      <Text style={[styles.unitChipText, selected && styles.unitChipTextSelected]}>{t(UNIT_LABEL_KEYS[unit])}</Text>
    </AnimatedPressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { textAlign }]}>{t("converter.weightVolumeTitle")}</Text>
        <TextInput
          style={[styles.amountInput, { textAlign }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="1"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { textAlign }]}>{t("converter.from")}</Text>
        <View style={styles.unitRow}>
          {WEIGHT_UNITS.map((u) => (
            <UnitChip key={u} unit={u} selected={fromUnit === u} onPress={() => selectFromUnit(u)} />
          ))}
        </View>
        <View style={styles.unitRow}>
          {VOLUME_UNITS.map((u) => (
            <UnitChip key={u} unit={u} selected={fromUnit === u} onPress={() => selectFromUnit(u)} />
          ))}
        </View>

        <Text style={[styles.label, { textAlign }]}>{t("converter.to")}</Text>
        <View style={styles.unitRow}>
          {compatibleUnits.map((u) => (
            <UnitChip key={u} unit={u} selected={toUnit === u} onPress={() => setToUnit(u)} />
          ))}
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultText}>
            {result !== null
              ? `${amount || "0"} ${t(UNIT_LABEL_KEYS[fromUnit])} = ${round2(result)} ${t(UNIT_LABEL_KEYS[toUnit])}`
              : t("converter.invalidNumber")}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("converter.ovenTitle")}</Text>
        <TextInput
          style={[styles.amountInput, { textAlign }]}
          value={ovenValue}
          onChangeText={setOvenValue}
          keyboardType="decimal-pad"
          placeholder="180"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.unitRow}>
          <AnimatedPressable
            style={[styles.unitChip, ovenFrom === "c" && styles.unitChipSelected]}
            pressScale={0.94}
            onPress={() => setOvenFrom("c")}
          >
            <Text style={[styles.unitChipText, ovenFrom === "c" && styles.unitChipTextSelected]}>°C</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.unitChip, ovenFrom === "f" && styles.unitChipSelected]}
            pressScale={0.94}
            onPress={() => setOvenFrom("f")}
          >
            <Text style={[styles.unitChipText, ovenFrom === "f" && styles.unitChipTextSelected]}>°F</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>
            {ovenResult !== null
              ? `${ovenValue || "0"}°${ovenFrom.toUpperCase()} = ${round2(ovenResult)}°${ovenFrom === "c" ? "F" : "C"}`
              : t("converter.invalidNumber")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: spacing(2), marginBottom: spacing(1.5) },
    label: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginTop: spacing(1.5), marginBottom: spacing(1) },
    amountInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    unitRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginBottom: spacing(0.5) },
    unitChip: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.85),
    },
    unitChipSelected: { backgroundColor: colors.primary },
    unitChipText: { fontSize: 13, fontWeight: "700", color: colors.text },
    unitChipTextSelected: { color: "#fff" },
    resultCard: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(2),
      marginTop: spacing(1.5),
      marginBottom: spacing(1),
    },
    resultText: { fontSize: 15, fontWeight: "800", color: colors.primaryDark, textAlign: "center" },
  });
