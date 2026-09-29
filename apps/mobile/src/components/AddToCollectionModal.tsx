import React, { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { useCollections } from "../context/CollectionsContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  recipe: RecipeSummary;
};

export function AddToCollectionModal({ visible, onClose, recipe }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { collections, addRecipe, removeRecipe, create } = useCollections();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  const toggle = (collectionId: string, has: boolean) => {
    if (has) removeRecipe(collectionId, recipe.slug).catch(() => {});
    else addRecipe(collectionId, recipe).catch(() => {});
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const collection = await create(name);
      await addRecipe(collection.id, recipe);
      setNewName("");
    } catch {
      // Swallow -- the list simply won't show the new collection.
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={[styles.title, { textAlign }]}>{t("collections.addToTitle")}</Text>
          <ScrollView style={styles.list}>
            {collections.map((c) => {
              const has = c.recipes.some((r) => r.slug === recipe.slug);
              return (
                <AnimatedPressable
                  key={c.id}
                  style={styles.row}
                  pressScale={0.99}
                  onPress={() => toggle(c.id, has)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: has }}
                >
                  <View style={[styles.checkbox, has && styles.checkboxChecked]}>
                    {has ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowCount}>{c.recipes.length}</Text>
                </AnimatedPressable>
              );
            })}
            {collections.length === 0 ? <Text style={styles.empty}>{t("collections.empty")}</Text> : null}
          </ScrollView>
          <View style={styles.newRow}>
            <TextInput
              style={[styles.newInput, { textAlign }]}
              placeholder={t("collections.newPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoCorrect={false}
            />
            <AnimatedPressable
              style={[styles.newButton, !newName.trim() && styles.newButtonDisabled]}
              pressScale={0.92}
              onPress={handleCreate}
              disabled={!newName.trim() || creating}
            >
              <Text style={styles.newButtonText}>{t("collections.create")}</Text>
            </AnimatedPressable>
          </View>
          <AnimatedPressable style={styles.close} pressScale={0.96} onPress={onClose}>
            <Text style={styles.closeText}>{t("cookMode.close")}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing(3),
      maxHeight: "80%",
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing(2) },
    list: { marginBottom: spacing(2) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing(1.25),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
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
    rowName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
    rowCount: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing(3) },
    newRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
    newInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.1),
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
    },
    newButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(1.25),
    },
    newButtonDisabled: { opacity: 0.5 },
    newButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    close: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.lg,
      paddingVertical: spacing(1.5),
      alignItems: "center",
      marginTop: spacing(2),
    },
    closeText: { color: colors.text, fontWeight: "700" },
  });
