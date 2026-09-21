import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { StepTimer } from "../components/StepTimer";
import { StreakCelebration } from "../components/StreakCelebration";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { useAuth } from "../context/AuthContext";
import { useCookStreak } from "../context/CookStreakContext";
import { useLeftovers } from "../context/LeftoversContext";
import { formatQuantity } from "../utils/units";
import { intersectAllergens } from "../utils/allergens";
import { radius, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "CookMode">;

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

export function CookModeScreen({ route, navigation }: Props) {
  useKeepAwake();
  const { slug, title, cuisineSlug, steps, ingredients, servings } = route.params;
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const { user } = useAuth();
  const { recordCooked } = useCookStreak();
  const { addLeftover } = useLeftovers();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [ingredientsVisible, setIngredientsVisible] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [gathered, setGathered] = useState<Set<string>>(new Set());
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);

  const toggleGathered = (name: string) => {
    setGathered((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = (index + 1) / steps.length;
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    if (!voiceEnabled) return;
    Speech.stop();
    Speech.speak(step.instruction, {
      language: isRTL ? "ar" : "en-US",
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, index]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (voiceEnabled) {
      Speech.stop();
      setSpeaking(false);
      setVoiceEnabled(false);
    } else {
      setVoiceEnabled(true);
    }
  };

  const confirmExit = () => {
    Alert.alert(t("cookMode.exitTitle"), t("cookMode.exitMessage"), [
      { text: t("cookMode.exitCancel"), style: "cancel" },
      { text: t("cookMode.exitConfirm"), style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  const showDoneAlert = (streak: number) => {
    const message = streak > 1 ? t("cookMode.doneMessageStreak", { streak }) : t("cookMode.doneMessage");
    Alert.alert(t("cookMode.doneTitle"), message, [
      {
        text: t("cookMode.saveLeftovers"),
        onPress: () => {
          addLeftover({ slug, title, cuisineSlug }, servings);
          navigation.goBack();
        },
      },
      { text: t("cookMode.doneButton"), onPress: () => navigation.goBack() },
    ]);
  };

  const goNext = () => {
    if (isLast) {
      const streak = recordCooked(slug);
      if (STREAK_MILESTONES.includes(streak)) {
        setCelebrationStreak(streak);
      } else {
        showDoneAlert(streak);
      }
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
        <View style={styles.headerRightGroup}>
          <AnimatedPressable
            style={[styles.iconButton, styles.voiceButtonSpacing, voiceEnabled && styles.iconButtonActive]}
            pressScale={0.9}
            onPress={toggleVoice}
            accessibilityLabel={t("cookMode.voiceToggle")}
          >
            <Text style={styles.iconButtonText}>{voiceEnabled ? (speaking ? "🔊" : "🔈") : "🔇"}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.iconButton} pressScale={0.9} onPress={() => setIngredientsVisible(true)}>
            <Text style={styles.iconButtonText}>📋</Text>
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <FadeSlideIn key={step.order} style={styles.stepContent}>
          <Text style={styles.emoji}>{CUISINE_EMOJI[cuisineSlug] ?? "🍽️"}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{step.order}</Text>
          </View>
          <Text style={[styles.instruction, { textAlign }]}>{step.instruction}</Text>
          {step.timerMinutes ? (
            <StepTimer
              minutes={step.timerMinutes}
              onFinish={() => {
                if (voiceEnabled) {
                  Speech.stop();
                  Speech.speak(t("cookMode.timeUp"), { language: isRTL ? "ar" : "en-US" });
                }
              }}
            />
          ) : null}
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
                const isGathered = gathered.has(ing.name);
                return (
                <AnimatedPressable
                  key={ing.name}
                  style={styles.modalCell}
                  pressScale={0.99}
                  onPress={() => toggleGathered(ing.name)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isGathered }}
                >
                  <View style={styles.modalRow}>
                    <View style={styles.modalRowNameGroup}>
                      <View style={[styles.modalCheckbox, isGathered && styles.modalCheckboxChecked]}>
                        {isGathered ? <Text style={styles.modalCheckboxMark}>✓</Text> : null}
                      </View>
                      <Text
                        style={[
                          styles.modalRowName,
                          ingredientConflicts.length > 0 && styles.modalRowNameWarning,
                          isGathered && styles.modalRowNameGathered,
                        ]}
                      >
                        {ing.name}
                      </Text>
                    </View>
                    <Text style={[styles.modalRowQty, isGathered && styles.modalRowNameGathered]}>
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
                </AnimatedPressable>
                );
              })}
            </ScrollView>
            <AnimatedPressable style={styles.modalClose} pressScale={0.96} onPress={() => setIngredientsVisible(false)}>
              <Text style={styles.modalCloseText}>{t("cookMode.close")}</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      <StreakCelebration
        visible={celebrationStreak !== null}
        streak={celebrationStreak ?? 0}
        title={t("cookMode.milestoneTitle", { streak: celebrationStreak ?? 0 })}
        subtitle={t("cookMode.milestoneSubtitle")}
        buttonLabel={t("cookMode.milestoneContinue")}
        onDismiss={() => {
          const streak = celebrationStreak;
          setCelebrationStreak(null);
          if (streak !== null) showDoneAlert(streak);
        }}
      />
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
    headerRightGroup: { flexDirection: "row", alignItems: "center" },
    voiceButtonSpacing: { marginEnd: spacing(1) },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonActive: { backgroundColor: colors.primary },
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
    stepContent: { width: "100%", alignItems: "center" },
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
      alignItems: "center",
    },
    modalRowNameGroup: { flexDirection: "row", alignItems: "center", flex: 1 },
    modalCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginEnd: spacing(1),
    },
    modalCheckboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    modalCheckboxMark: { color: "#fff", fontSize: 11, fontWeight: "800" },
    modalRowName: { color: colors.text, fontSize: 14 },
    modalRowNameWarning: { color: colors.danger, fontWeight: "700" },
    modalRowNameGathered: { color: colors.textMuted, textDecorationLine: "line-through" },
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
