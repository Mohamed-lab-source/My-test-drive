import React, { useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { StepTimer } from "../components/StepTimer";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { useAuth } from "../context/AuthContext";
import { useCookStreak } from "../context/CookStreakContext";
import { formatQuantity } from "../utils/units";
import { intersectAllergens } from "../utils/allergens";
import { radius, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "CookMode">;

export function CookModeScreen({ route, navigation }: Props) {
  useKeepAwake();
  const { title, cuisineSlug, steps, ingredients, servings } = route.params;
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const { user } = useAuth();
  const { recordCooked } = useCookStreak();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [ingredientsVisible, setIngredientsVisible] = useState(false);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = (index + 1) / steps.length;
  const textAlign = isRTL ? "right" : "left";

  const confirmExit = () => {
    Alert.alert(t("cookMode.exitTitle"), t("cookMode.exitMessage"), [
      { text: t("cookMode.exitCancel"), style: "cancel" },
      { text: t("cookMode.exitConfirm"), style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  const goNext = () => {
    if (isLast) {
      const streak = recordCooked();
      const message = streak > 1 ? t("cookMode.doneMessageStreak", { streak }) : t("cookMode.doneMessage");
      Alert.alert(t("cookMode.doneTitle"), message, [
        { text: t("cookMode.doneButton"), onPress: () => navigation.goBack() },
      ]);
      return;
    }
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.iconButton} pressScale={0.9} onPress={confirmExit}>
          <Text style={styles.iconButtonText}>✕</Text>
        </AnimatedPressable>
        <Text style={styles.stepOf}>{t("cookMode.stepOf", { current: index + 1, total: steps.length })}</Text>
        <AnimatedPressable style={styles.iconButton} pressScale={0.9} onPress={() => setIngredientsVisible(true)}>
          <Text style={styles.iconButtonText}>📋</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <FadeSlideIn key={step.order}>
          <Text style={styles.emoji}>{CUISINE_EMOJI[cuisineSlug] ?? "🍽️"}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{step.order}</Text>
          </View>
          <Text style={[styles.instruction, { textAlign }]}>{step.instruction}</Text>
          {step.timerMinutes ? <StepTimer minutes={step.timerMinutes} /> : null}
        </FadeSlideIn>
      </ScrollView>

      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.navButton, styles.navButtonOutline, index === 0 && styles.navButtonDisabled]}
          pressScale={0.96}
          disabled={index === 0}
          onPress={goBack}
        >
          <Text style={styles.navButtonOutlineText}>{t("cookMode.back")}</Text>
        </AnimatedPressable>
        <AnimatedPressable style={[styles.navButton, styles.navButtonSolid]} pressScale={0.96} onPress={goNext}>
          <Text style={styles.navButtonSolidText}>{isLast ? t("cookMode.finish") : t("cookMode.next")}</Text>
        </AnimatedPressable>
      </View>

      <Modal visible={ingredientsVisible} animationType="slide" transparent onRequestClose={() => setIngredientsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { textAlign }]}>{title}</Text>
            <Text style={[styles.modalSubtitle, { textAlign }]}>
              {t("cookMode.ingredients")} · {servings}
            </Text>
            <ScrollView style={styles.modalList}>
              {ingredients.map((ing) => {
                const ingredientConflicts = intersectAllergens(ing.allergens, user?.preference?.allergies ?? []);
                return (
                <View key={ing.name} style={styles.modalCell}>
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalRowName, ingredientConflicts.length > 0 && styles.modalRowNameWarning]}>
                      {ing.name}
                    </Text>
                    <Text style={styles.modalRowQty}>
                      {formatQuantity(ing.quantity, ing.unit, unitSystem)}
                    </Text>
                  </View>
                  {ingredientConflicts.length > 0 ? (
                    <Text style={[styles.modalRowAllergenNote, { textAlign }]}>
                      {ingredientConflicts.map((a) => t(`allergen.${a}` as TranslationKey)).join(", ")}
                    </Text>
                  ) : null}
                  {ing.substitute ? (
                    <Text style={[styles.modalRowSubstitute, { textAlign }]}>
                      {t("recipeDetail.substituteHint", { substitute: ing.substitute })}
                    </Text>
                  ) : null}
                </View>
                );
              })}
            </ScrollView>
            <AnimatedPressable style={styles.modalClose} pressScale={0.96} onPress={() => setIngredientsVisible(false)}>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing(2),
      paddingTop: spacing(1),
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonText: { fontSize: 18, color: colors.text },
    stepOf: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
    progressTrack: {
      height: 4,
      backgroundColor: colors.chipBackground,
      marginTop: spacing(1.5),
      marginHorizontal: spacing(2),
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    content: { flexGrow: 1, alignItems: "center", padding: spacing(3), paddingTop: spacing(4) },
    emoji: { fontSize: 56, marginBottom: spacing(2) },
    badge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing(2),
    },
    badgeText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    instruction: { fontSize: 22, lineHeight: 32, fontWeight: "600", color: colors.text, width: "100%" },
    footer: {
      flexDirection: "row",
      gap: spacing(1.5),
      padding: spacing(2),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    navButton: {
      flex: 1,
      paddingVertical: spacing(1.75),
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    navButtonSolid: { backgroundColor: colors.primary },
    navButtonSolidText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    navButtonOutline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
    navButtonOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
    navButtonDisabled: { opacity: 0.4 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing(3),
      maxHeight: "75%",
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    modalSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing(2) },
    modalList: { marginBottom: spacing(2) },
    modalCell: {
      paddingVertical: spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    modalRowName: { color: colors.text, fontSize: 14 },
    modalRowNameWarning: { color: colors.danger, fontWeight: "700" },
    modalRowQty: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    modalRowSubstitute: { color: colors.primaryDark, fontSize: 11, marginTop: 2 },
    modalRowAllergenNote: { color: colors.danger, fontSize: 11, fontWeight: "700", marginTop: 2 },
    modalClose: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.lg,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    modalCloseText: { color: colors.text, fontWeight: "700" },
  });
