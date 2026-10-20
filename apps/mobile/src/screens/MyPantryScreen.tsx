import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchIngredients } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { normalizePantryName, usePantryCheck } from "../context/PantryCheckContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { STAPLES } from "../data/staples";
import { radius, spacing, type ThemeColors } from "../theme";
import type { PantryIngredient } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "MyPantry">;

const MAX_SUGGESTIONS = 6;

export function MyPantryScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { items, isChecked, add, remove, setMany, clear } = usePantryCheck();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<PantryIngredient[]>([]);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    fetchIngredients().then(setCatalog).catch(() => {});
  }, [locale]);

  const trimmed = query.trim();
  const suggestions = trimmed
    ? catalog
        .filter((i) => normalizePantryName(i.name).includes(normalizePantryName(trimmed)) && !isChecked(i.name))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const stapleNames = STAPLES.map((s) => s[locale]);
  const missingStaples = stapleNames.filter((name) => !isChecked(name));

  const addName = (name: string) => {
    add(name);
    setQuery("");
  };

  const removeWithUndo = (name: string) => {
    remove(name);
    showToast(t("myPantry.removed", { name }), { actionLabel: t("home.undo"), onAction: () => add(name) });
  };

  const confirmClear = () => {
    Alert.alert(t("myPantry.clearConfirmTitle"), t("myPantry.clearConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("myPantry.clear"), style: "destructive", onPress: clear },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { textAlign }]}>{t("myPantry.subtitle")}</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { textAlign }]}
            placeholder={t("myPantry.addPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => trimmed && addName(trimmed)}
            returnKeyType="done"
            autoCorrect={false}
          />
          <AnimatedPressable
            style={[styles.addButton, !trimmed && styles.disabled]}
            pressScale={0.92}
            disabled={!trimmed}
            onPress={() => addName(trimmed)}
          >
            <Text style={styles.addButtonText}>{t("myPantry.add")}</Text>
          </AnimatedPressable>
        </View>
        {suggestions.length > 0 ? (
          <View style={styles.chipRow}>
            {suggestions.map((s) => (
              <Chip key={s.id} label={`+ ${s.name}`} onPress={() => addName(s.name)} />
            ))}
          </View>
        ) : null}

        {missingStaples.length > 0 ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { textAlign }]}>{t("myPantry.staplesTitle")}</Text>
              <AnimatedPressable pressScale={0.95} onPress={() => setMany(missingStaples, true)}>
                <Text style={styles.link}>{t("myPantry.addAllStaples")}</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.chipRow}>
              {missingStaples.map((name) => (
                <Chip key={name} label={`+ ${name}`} onPress={() => add(name)} />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("myPantry.listTitle", { count: items.length })}</Text>
        {items.length === 0 ? (
          <Text style={[styles.empty, { textAlign }]}>{t("myPantry.empty")}</Text>
        ) : (
          items.map((name) => (
            <View key={name} style={styles.itemRow}>
              <Text style={styles.itemName}>✓ {name}</Text>
              <AnimatedPressable
                pressScale={0.85}
                onPress={() => removeWithUndo(name)}
                accessibilityRole="button"
                accessibilityLabel={t("myPantry.remove", { name })}
              >
                <Text style={styles.removeText}>✕</Text>
              </AnimatedPressable>
            </View>
          ))
        )}

        <View style={styles.findButton}>
          <PrimaryButton
            label={t("myPantry.findRecipes")}
            disabled={items.length === 0}
            onPress={() => navigation.navigate("PantryFinder", { usePantry: true })}
          />
        </View>
        {items.length > 0 ? (
          <AnimatedPressable style={styles.clearButton} pressScale={0.95} onPress={confirmClear}>
            <Text style={styles.clearText}>{t("myPantry.clear")}</Text>
          </AnimatedPressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(2) },
    inputRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
    },
    addButtonText: { color: "#fff", fontWeight: "800" },
    disabled: { opacity: 0.5 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginTop: spacing(1) },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3) },
    link: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    empty: { color: colors.textMuted, marginTop: spacing(1), lineHeight: 20 },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing(1.25),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemName: { fontSize: 15, color: colors.text, flex: 1 },
    removeText: { fontSize: 15, color: colors.textMuted, paddingHorizontal: spacing(1) },
    findButton: { marginTop: spacing(3) },
    clearButton: { alignSelf: "center", marginTop: spacing(2) },
    clearText: { color: colors.danger, fontWeight: "700" },
  });
