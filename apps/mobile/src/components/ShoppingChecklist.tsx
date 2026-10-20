import React, { useEffect, useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "./AnimatedPressable";
import { Chip } from "./Chip";
import { FadeSlideIn } from "./FadeSlideIn";
import { PrimaryButton } from "./PrimaryButton";
import { usePantryCheck } from "../context/PantryCheckContext";
import { useShoppingExtras } from "../context/ShoppingExtrasContext";
import { useUnits } from "../context/UnitsContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { formatQuantity } from "../utils/units";
import { shareViaWhatsApp } from "../utils/whatsapp";
import { categoryEmoji, categoryLabelKey, groupByCategory } from "../utils/ingredientCategory";
import { radius, spacing, type ThemeColors } from "../theme";

const SORT_KEY = "cookmate.shoppingSort";

export type ChecklistItem = {
  key: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  category: string | null;
};

type Props = {
  items: ChecklistItem[];
  /** Heading for shared lists, e.g. "Shopping list for Koshari". */
  shareTitle: string;
};

/**
 * The tickable shopping list shared by the generated and saved list screens.
 * A tick means "I have this" and lives in the pantry, so it carries over to
 * every other list that needs the same ingredient.
 */
export function ShoppingChecklist({ items, shareTitle }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isChecked, toggle, setMany } = usePantryCheck();
  const { extras, addExtra, toggleExtra, removeExtra, clearDoneExtras } = useShoppingExtras();
  const [sortMode, setSortMode] = useState<"aisle" | "az">("aisle");
  const [hideHave, setHideHave] = useState(false);
  const [extraText, setExtraText] = useState("");
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    AsyncStorage.getItem(SORT_KEY)
      .then((stored) => {
        if (stored === "az" || stored === "aisle") setSortMode(stored);
      })
      .catch(() => {});
  }, []);

  const chooseSort = (mode: "aisle" | "az") => {
    setSortMode(mode);
    AsyncStorage.setItem(SORT_KEY, mode).catch(() => {});
  };

  const haveCount = items.filter((i) => isChecked(i.ingredientName)).length;
  const doneExtras = extras.filter((e) => e.done).length;
  const totalCount = items.length + extras.length;
  const doneCount = haveCount + doneExtras;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;
  const remainingCost = items.reduce((sum, i) => (isChecked(i.ingredientName) ? sum : sum + i.estimatedCost), 0);
  const pantrySavings = items.reduce((sum, i) => (isChecked(i.ingredientName) ? sum + i.estimatedCost : sum), 0);

  const visible = hideHave ? items.filter((i) => !isChecked(i.ingredientName)) : items;
  const groups =
    sortMode === "aisle"
      ? groupByCategory(visible)
      : [{ category: "az", items: [...visible].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)) }];

  const remainingLines = () => [
    ...items
      .filter((i) => !isChecked(i.ingredientName))
      .map((i) => `- ${i.ingredientName}: ${formatQuantity(i.quantity, i.unit, unitSystem)}`),
    ...extras.filter((e) => !e.done).map((e) => `- ${e.name}`),
  ];

  const buildMessage = () =>
    [
      shareTitle,
      "",
      ...remainingLines(),
      "",
      t("shoppingList.stillNeed", { amount: remainingCost.toFixed(2) }),
      t("share.branding"),
    ].join("\n");

  const shareText = () => {
    Share.share({ message: buildMessage() }).catch(() => {});
  };


  const untickAll = () => {
    Alert.alert(t("shoppingChecklist.untickConfirmTitle"), t("shoppingChecklist.untickConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      {
        text: t("shoppingChecklist.untickAll"),
        style: "destructive",
        onPress: () => {
          setMany(
            items.map((i) => i.ingredientName),
            false
          );
          clearDoneExtras();
        },
      },
    ]);
  };

  const submitExtra = () => {
    addExtra(extraText);
    setExtraText("");
  };

  const renderItem = (item: ChecklistItem, i: number) => {
    const have = isChecked(item.ingredientName);
    return (
      <FadeSlideIn key={item.key} index={i}>
        <AnimatedPressable
          style={styles.itemRow}
          pressScale={0.99}
          onPress={() => toggle(item.ingredientName)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: have }}
        >
          <View style={styles.itemLeft}>
            <View style={[styles.checkbox, have && styles.checkboxChecked]}>
              {have ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={[styles.itemName, have && styles.itemNameChecked]}>{item.ingredientName}</Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={[styles.itemQty, have && styles.itemNameChecked]}>
              {formatQuantity(item.quantity, item.unit, unitSystem)}
            </Text>
            <Text style={[styles.itemCost, have && styles.itemNameChecked]}>{item.estimatedCost.toFixed(2)} EGP</Text>
          </View>
        </AnimatedPressable>
      </FadeSlideIn>
    );
  };

  return (
    <View>
      <View style={styles.progressCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.progressText}>
            {t("shoppingChecklist.progress", { done: doneCount, total: totalCount })}
          </Text>
          <Text style={styles.remainingText}>{t("shoppingList.stillNeed", { amount: remainingCost.toFixed(2) })}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        {pantrySavings > 0 ? (
          <Text style={[styles.savingsText, { textAlign }]}>
            {t("shoppingChecklist.pantrySavings", { amount: pantrySavings.toFixed(2) })}
          </Text>
        ) : null}
      </View>

      <View style={styles.controlsRow}>
        <Chip label={t("shoppingChecklist.sortAisle")} selected={sortMode === "aisle"} onPress={() => chooseSort("aisle")} />
        <Chip label={t("shoppingChecklist.sortAZ")} selected={sortMode === "az"} onPress={() => chooseSort("az")} />
        <Chip label={t("shoppingChecklist.hideHave")} selected={hideHave} onPress={() => setHideHave((v) => !v)} />
      </View>
      <Text style={[styles.hint, { textAlign }]}>{t("shoppingList.pantryHint")}</Text>

      {groups.map((group) => {
        const groupNames = group.items.map((i) => i.ingredientName);
        const allHave = groupNames.length > 0 && groupNames.every((n) => isChecked(n));
        return (
          <View key={group.category}>
            {sortMode === "aisle" ? (
              <View style={styles.aisleHeaderRow}>
                <Text style={[styles.aisleHeader, { textAlign }]}>
                  {categoryEmoji(group.category)} {t(categoryLabelKey(group.category))}
                </Text>
                <AnimatedPressable
                  pressScale={0.92}
                  onPress={() => setMany(groupNames, !allHave)}
                  accessibilityRole="button"
                >
                  <Text style={styles.aisleAction}>
                    {allHave ? t("shoppingChecklist.aisleUntick") : t("shoppingChecklist.aisleTick")}
                  </Text>
                </AnimatedPressable>
              </View>
            ) : null}
            {group.items.map(renderItem)}
          </View>
        );
      })}
      {hideHave && visible.length === 0 && items.length > 0 ? (
        <Text style={[styles.hint, styles.allDone, { textAlign }]}>{t("shoppingChecklist.allHave")}</Text>
      ) : null}

      <Text style={[styles.sectionTitle, { textAlign }]}>{t("shoppingChecklist.extrasTitle")}</Text>
      {extras.map((extra) => (
        <View key={extra.id} style={styles.itemRow}>
          <AnimatedPressable
            style={styles.itemLeft}
            pressScale={0.99}
            onPress={() => toggleExtra(extra.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: extra.done }}
          >
            <View style={[styles.checkbox, extra.done && styles.checkboxChecked]}>
              {extra.done ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={[styles.itemName, extra.done && styles.itemNameChecked]}>{extra.name}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            pressScale={0.85}
            onPress={() => removeExtra(extra.id)}
            accessibilityRole="button"
            accessibilityLabel={t("shoppingChecklist.removeExtra")}
          >
            <Text style={styles.removeText}>✕</Text>
          </AnimatedPressable>
        </View>
      ))}
      <View style={styles.extraInputRow}>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("shoppingChecklist.extraPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={extraText}
          onChangeText={setExtraText}
          onSubmitEditing={submitExtra}
          returnKeyType="done"
        />
        <AnimatedPressable
          style={[styles.addButton, !extraText.trim() && styles.disabled]}
          pressScale={0.92}
          disabled={!extraText.trim()}
          onPress={submitExtra}
        >
          <Text style={styles.addButtonText}>{t("shoppingChecklist.addExtra")}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.linkRow}>
        <AnimatedPressable pressScale={0.95} onPress={() => navigation.navigate("MyPantry")}>
          <Text style={styles.link}>{t("shoppingChecklist.managePantry")}</Text>
        </AnimatedPressable>
        {doneCount > 0 ? (
          <AnimatedPressable pressScale={0.95} onPress={untickAll}>
            <Text style={[styles.link, styles.dangerLink]}>{t("shoppingChecklist.untickAll")}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <View style={styles.shareRow}>
        <View style={styles.flex1}>
          <PrimaryButton label={t("shoppingList.share")} variant="outline" onPress={shareText} />
        </View>
        <View style={styles.flex1}>
          <PrimaryButton label={t("share.whatsApp")} variant="outline" onPress={() => shareViaWhatsApp(buildMessage())} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    progressCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginBottom: spacing(1.5),
    },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" },
    progressText: { fontSize: 13, fontWeight: "800", color: colors.text },
    remainingText: { fontSize: 12, fontWeight: "700", color: colors.secondary },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.chipBackground, overflow: "hidden", marginTop: spacing(1) },
    fill: { height: "100%", borderRadius: 4, backgroundColor: colors.success },
    savingsText: { fontSize: 12, color: colors.success, fontWeight: "700", marginTop: spacing(0.75) },
    controlsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1), marginBottom: spacing(0.5) },
    allDone: { color: colors.success, fontWeight: "700" },
    aisleHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing(1.5),
      marginBottom: 2,
    },
    aisleHeader: { fontSize: 12, fontWeight: "800", color: colors.textMuted },
    aisleAction: { fontSize: 12, fontWeight: "700", color: colors.primary },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
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
    itemRight: { alignItems: "flex-end" },
    itemQty: { color: colors.textMuted, fontSize: 13 },
    itemCost: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
    removeText: { fontSize: 15, color: colors.textMuted, paddingHorizontal: spacing(1) },
    extraInputRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginTop: spacing(1) },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
    },
    addButtonText: { color: "#fff", fontWeight: "800" },
    disabled: { opacity: 0.5 },
    linkRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing(2) },
    link: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    dangerLink: { color: colors.danger },
    shareRow: { flexDirection: "row", gap: spacing(1), marginTop: spacing(2) },
    flex1: { flex: 1 },
  });
