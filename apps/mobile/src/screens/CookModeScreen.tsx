import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { TimerTray } from "../components/TimerTray";
import { StreakCelebration } from "../components/StreakCelebration";
import { classifyStepType, STEP_TYPE_EMOJI } from "../utils/stepType";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { useCookStreak } from "../context/CookStreakContext";
import { useToast } from "../context/ToastContext";
import { useFoodDiary } from "../context/FoodDiaryContext";
import { useLeftovers } from "../context/LeftoversContext";
import { useTextSize } from "../context/TextSizeContext";
import { useKitchenTimers } from "../context/KitchenTimersContext";
import { useCookingJournal } from "../context/CookingJournalContext";
import { formatClock } from "../utils/recipeBadges";
import { formatQuantity } from "../utils/units";
import { intersectAllergens, useMyAllergies } from "../utils/allergens";
import { clearActiveCookSession, saveActiveCookSession } from "../utils/activeCookSession";
import { radius, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "CookMode">;

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
const TEXT_BOOST_KEY = "cookmate.cookMode.textBoost";
const TEXT_BOOSTS = [1, 1.25, 1.5];
const STEP_NOTES_PREFIX = "cookmate.stepNotes.";
/** Rough time for a step with no timer, used for the "done by" estimate. */
const MINUTES_PER_UNTIMED_STEP = 3;
const SWIPE_THRESHOLD = 60;
const OVEN_PATTERN = /\boven\b|\bbake|\broast|\bbroil|فرن|اخبز/i;

export function CookModeScreen({ route, navigation }: Props) {
  useKeepAwake();
  const { slug, title, cuisineSlug, steps, ingredients, servings, myRating, initialStepIndex, nutrition } = route.params;
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const { unitSystem } = useUnits();
  const myAllergies = useMyAllergies();
  const { recordCooked } = useCookStreak();
  const { timers, start: startTimer, lastFinished } = useKitchenTimers();
  const { addEntry: addJournalEntry } = useCookingJournal();
  const startedAtRef = useRef(Date.now());
  const [textBoost, setTextBoost] = useState(1);
  const [cookServings, setCookServings] = useState(servings);
  const [stepNotes, setStepNotes] = useState<Record<number, string>>({});
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [preheatDismissed, setPreheatDismissed] = useState(false);
  const { addLeftover } = useLeftovers();
  const { addEntry: addDiaryEntry } = useFoodDiary();
  const { showToast } = useToast();
  const { scale: textScale } = useTextSize();
  const styles = useMemo(() => createStyles(colors, textScale), [colors, textScale]);
  const [index, setIndex] = useState(initialStepIndex ?? 0);
  const [ingredientsVisible, setIngredientsVisible] = useState(false);
  const [allStepsVisible, setAllStepsVisible] = useState(false);
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

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(TEXT_BOOST_KEY), AsyncStorage.getItem(`${STEP_NOTES_PREFIX}${slug}`)])
      .then(([boost, notes]) => {
        if (boost && TEXT_BOOSTS.includes(Number(boost))) setTextBoost(Number(boost));
        if (notes) setStepNotes(JSON.parse(notes));
      })
      .catch(() => {});
  }, [slug]);

  const cycleTextBoost = () => {
    const next = TEXT_BOOSTS[(TEXT_BOOSTS.indexOf(textBoost) + 1) % TEXT_BOOSTS.length];
    setTextBoost(next);
    AsyncStorage.setItem(TEXT_BOOST_KEY, String(next)).catch(() => {});
  };

  // Speak and announce timers that finish while cooking (ignoring ones that ended before we opened).
  useEffect(() => {
    if (!lastFinished || lastFinished.at < startedAtRef.current) return;
    showToast(t("timers.doneToast", { label: lastFinished.label }));
    if (voiceEnabled) {
      Speech.stop();
      Speech.speak(`${t("cookMode.timeUp")} ${lastFinished.label}`, { language: isRTL ? "ar" : "en-US" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFinished?.at]);

  useEffect(() => {
    setNoteDraft(null);
  }, [index]);

  const saveStepNote = (order: number, text: string) => {
    setStepNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[order] = text.trim();
      else delete next[order];
      AsyncStorage.setItem(`${STEP_NOTES_PREFIX}${slug}`, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setNoteDraft(null);
  };

  useEffect(() => {
    saveActiveCookSession({ slug, title, cuisineSlug, stepIndex: index, totalSteps: steps.length, servings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = (index + 1) / steps.length;
  const textAlign = isRTL ? "right" : "left";
  const remainingMinutes = steps
    .slice(index)
    .reduce((sum, s) => sum + (s.timerMinutes ?? MINUTES_PER_UNTIMED_STEP), 0);
  const doneBy = formatClock(new Date(Date.now() + remainingMinutes * 60000), locale);
  const ovenStepIndex = useMemo(() => steps.findIndex((s) => OVEN_PATTERN.test(s.instruction)), [steps]);
  const showPreheat = !preheatDismissed && ovenStepIndex > 0 && index < ovenStepIndex;
  const stepTimerTag = `${slug}:${step.order}`;
  const stepTimerRunning = timers.some((tm) => tm.tag === stepTimerTag && !tm.done);
  const servingsScale = cookServings / servings;

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

  /**
   * Offered after the "done" alert closes rather than alongside it: Android
   * alerts cap at 3 buttons (already used), and a toast shown under the
   * modal alert would expire unseen.
   */
  const offerDiaryLog = () => {
    if (!nutrition) return;
    showToast(t("diary.logAfterCooking"), {
      actionLabel: t("diary.logAction"),
      onAction: () => {
        addDiaryEntry({
          title,
          slug,
          cuisineSlug,
          servings: 1,
          calories: Math.round(nutrition.calories),
          protein: Math.round(nutrition.protein),
          fat: Math.round(nutrition.fat),
          carbs: Math.round(nutrition.carbs),
        });
        showToast(t("diary.logged"));
      },
    });
  };

  const showDoneAlert = (streak: number) => {
    const message = streak > 1 ? t("cookMode.doneMessageStreak", { streak }) : t("cookMode.doneMessage");
    const buttons = [
      {
        text: t("cookMode.saveLeftovers"),
        onPress: () => {
          addLeftover({ slug, title, cuisineSlug }, servings);
          navigation.goBack();
          offerDiaryLog();
        },
      },
    ];
    if (!myRating) {
      buttons.push({
        text: t("cookMode.rateNow"),
        onPress: () => {
          navigation.navigate("RecipeDetail", { slug, focusRating: true });
          offerDiaryLog();
        },
      });
    }
    buttons.push({
      text: t("cookMode.doneButton"),
      onPress: () => {
        navigation.goBack();
        offerDiaryLog();
      },
    });
    Alert.alert(t("cookMode.doneTitle"), message, buttons);
  };

  const goNext = () => {
    if (isLast) {
      clearActiveCookSession();
      addJournalEntry({
        slug,
        title,
        cuisineSlug,
        finishedAt: new Date().toISOString(),
        durationMin: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000)),
        servings: cookServings,
      });
      const streak = recordCooked({ slug, title, cuisineSlug });
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

  // Swipe between steps; the last step still needs an explicit tap on Finish.
  const swipeRef = useRef({ next: () => {}, prev: () => {} });
  swipeRef.current = {
    next: () => {
      if (!isLast) setIndex((i) => Math.min(steps.length - 1, i + 1));
    },
    prev: goBack,
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < SWIPE_THRESHOLD) return;
          const forward = isRTL ? g.dx > 0 : g.dx < 0;
          if (forward) swipeRef.current.next();
          else swipeRef.current.prev();
        },
      }),
    [isRTL]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.iconButton}
          pressScale={0.9}
          onPress={confirmExit}
          accessibilityLabel={t("cookMode.exitTitle")}
        >
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
          <AnimatedPressable
            style={styles.iconButton}
            pressScale={0.9}
            onPress={() => setIngredientsVisible(true)}
            accessibilityLabel={t("cookMode.ingredients")}
          >
            <Text style={styles.iconButtonText}>📋</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.iconButton, styles.voiceButtonSpacing]}
            pressScale={0.9}
            onPress={() => setAllStepsVisible(true)}
            accessibilityLabel={t("cookMode.viewAllSteps")}
          >
            <Text style={styles.iconButtonText}>📖</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.iconButton, styles.voiceButtonSpacing]}
            pressScale={0.9}
            onPress={() => navigation.navigate("UnitConverter")}
            accessibilityLabel={t("converter.title")}
          >
            <Text style={styles.iconButtonText}>⚖️</Text>
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.toolbar}>
        <Text style={[styles.eta, { textAlign }]} numberOfLines={1}>
          {t("cookMode.eta", { minutes: remainingMinutes, time: doneBy })}
        </Text>
        <AnimatedPressable
          style={[styles.toolButton, textBoost > 1 && styles.iconButtonActive]}
          pressScale={0.9}
          onPress={cycleTextBoost}
          accessibilityLabel={t("cookMode.textSize")}
        >
          <Text style={styles.toolButtonText}>Aa{textBoost > 1 ? ` ${Math.round(textBoost * 100)}%` : ""}</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.toolButton}
          pressScale={0.9}
          onPress={() => navigation.navigate("KitchenTimer")}
          accessibilityLabel={t("timers.title")}
        >
          <Text style={styles.toolButtonText}>⏲️ +</Text>
        </AnimatedPressable>
      </View>
      <TimerTray compact />
      {showPreheat ? (
        <View style={styles.preheatBanner}>
          <Text style={[styles.preheatText, { textAlign }]}>
            {t("cookMode.preheat", { step: ovenStepIndex + 1 })}
          </Text>
          <AnimatedPressable pressScale={0.9} onPress={() => setPreheatDismissed(true)} accessibilityLabel={t("cookMode.close")}>
            <Text style={styles.preheatClose}>✕</Text>
          </AnimatedPressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} {...panResponder.panHandlers}>
        <FadeSlideIn key={step.order} style={styles.stepContent}>
          <Text style={styles.emoji}>{STEP_TYPE_EMOJI[classifyStepType(step.instruction)]}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{step.order}</Text>
          </View>
          <Text
            style={[
              styles.instruction,
              { textAlign, fontSize: 22 * textScale * textBoost, lineHeight: 32 * textScale * textBoost },
            ]}
          >
            {step.instruction}
          </Text>
          {step.timerMinutes ? (
            stepTimerRunning ? (
              <Text style={styles.timerHint}>{t("timers.runningAbove")}</Text>
            ) : (
              <AnimatedPressable
                style={styles.timerButton}
                pressScale={0.94}
                onPress={() =>
                  startTimer(t("timers.stepLabel", { step: step.order, title }), step.timerMinutes as number, stepTimerTag)
                }
              >
                <Text style={styles.timerButtonText}>{t("timers.startStep", { minutes: step.timerMinutes })}</Text>
              </AnimatedPressable>
            )
          ) : null}
          {noteDraft !== null ? (
            <View style={styles.noteEditor}>
              <TextInput
                style={[styles.noteInput, { textAlign }]}
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder={t("cookMode.stepNotePlaceholder")}
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
              />
              <AnimatedPressable pressScale={0.95} onPress={() => saveStepNote(step.order, noteDraft)}>
                <Text style={styles.noteAction}>{t("cookMode.saveStepNote")}</Text>
              </AnimatedPressable>
            </View>
          ) : stepNotes[step.order] ? (
            <AnimatedPressable pressScale={0.98} onPress={() => setNoteDraft(stepNotes[step.order])}>
              <Text style={[styles.stepNote, { textAlign }]}>📝 {stepNotes[step.order]}</Text>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable pressScale={0.95} onPress={() => setNoteDraft("")}>
              <Text style={styles.noteAction}>{t("cookMode.addStepNote")}</Text>
            </AnimatedPressable>
          )}
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
            <View style={styles.modalServingsRow}>
              <Text style={[styles.modalSubtitle, { textAlign }]}>
                {t("cookMode.ingredientsForServings", { count: cookServings })}
              </Text>
              <View style={styles.modalStepper}>
                <AnimatedPressable
                  style={styles.modalStepperButton}
                  pressScale={0.88}
                  onPress={() => setCookServings((s) => Math.max(1, s - 1))}
                  accessibilityLabel={t("recipeDetail.fewerPeople")}
                >
                  <Text style={styles.modalStepperText}>−</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.modalStepperButton}
                  pressScale={0.88}
                  onPress={() => setCookServings((s) => Math.min(50, s + 1))}
                  accessibilityLabel={t("recipeDetail.morePeople")}
                >
                  <Text style={styles.modalStepperText}>+</Text>
                </AnimatedPressable>
              </View>
            </View>
            <ScrollView style={styles.modalList}>
              {ingredients.map((ing) => {
                const ingredientConflicts = intersectAllergens(ing.allergens, myAllergies);
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
                      {formatQuantity(Math.round(ing.quantity * servingsScale * 100) / 100, ing.unit, unitSystem)}
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

      <Modal visible={allStepsVisible} animationType="slide" transparent onRequestClose={() => setAllStepsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { textAlign }]}>{title}</Text>
            <Text style={[styles.modalSubtitle, { textAlign }]}>{t("cookMode.viewAllSteps")}</Text>
            <ScrollView style={styles.modalList}>
              {steps.map((s) => (
                <AnimatedPressable
                  key={s.order}
                  style={styles.modalCell}
                  pressScale={0.99}
                  onPress={() => {
                    setIndex(s.order - 1);
                    setAllStepsVisible(false);
                  }}
                >
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalRowName, s.order - 1 === index && styles.modalRowCurrent]}>
                      {s.order}. {s.instruction}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
            <AnimatedPressable style={styles.modalClose} pressScale={0.96} onPress={() => setAllStepsVisible(false)}>
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

const createStyles = (colors: ThemeColors, textScale: number) =>
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
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1),
      paddingHorizontal: spacing(2),
      paddingTop: spacing(1),
    },
    eta: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.textMuted },
    toolButton: {
      height: 32,
      paddingHorizontal: spacing(1.25),
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    toolButtonText: { fontSize: 13, fontWeight: "800", color: colors.text },
    preheatBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.chipBackground,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: radius.md,
      marginHorizontal: spacing(2),
      marginTop: spacing(1),
      padding: spacing(1.25),
    },
    preheatText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primaryDark },
    preheatClose: { fontSize: 14, color: colors.textMuted, paddingHorizontal: spacing(1) },
    timerButton: {
      marginTop: spacing(2),
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.25),
      paddingHorizontal: spacing(3),
    },
    timerButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    timerHint: { marginTop: spacing(2), fontSize: 13, fontWeight: "700", color: colors.success },
    noteEditor: { width: "100%", marginTop: spacing(2) },
    noteInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing(1.25),
      minHeight: 60,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: "top",
    },
    noteAction: { marginTop: spacing(1.5), fontSize: 13, fontWeight: "800", color: colors.primary },
    stepNote: {
      marginTop: spacing(2),
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.chipBackground,
      borderRadius: radius.sm,
      padding: spacing(1.25),
      width: "100%",
    },
    modalServingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    modalStepper: { flexDirection: "row", gap: spacing(1) },
    modalStepperButton: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    modalStepperText: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
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
    instruction: {
      fontSize: 22 * textScale,
      lineHeight: 32 * textScale,
      fontWeight: "600",
      color: colors.text,
      width: "100%",
    },
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
    modalRowName: { color: colors.text, fontSize: 14 * textScale },
    modalRowNameWarning: { color: colors.danger, fontWeight: "700" },
    modalRowNameGathered: { color: colors.textMuted, textDecorationLine: "line-through" },
    modalRowCurrent: { color: colors.primaryDark, fontWeight: "800" },
    modalRowQty: { color: colors.textMuted, fontSize: 14 * textScale, fontWeight: "600" },
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
