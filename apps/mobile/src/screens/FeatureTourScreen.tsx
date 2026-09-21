import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "FeatureTour">;

/**
 * One step per feature area. When a new feature ships, extend the most
 * relevant existing step's body (or append a new step if it doesn't fit
 * any of them) rather than leaving the tour to drift out of date --
 * see CLAUDE.md for the full convention.
 */
const FEATURE_TOUR_STEPS: { icon: string; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { icon: "🔍", titleKey: "featureTour.browse.title", bodyKey: "featureTour.browse.body" },
  { icon: "🌟", titleKey: "featureTour.daily.title", bodyKey: "featureTour.daily.body" },
  { icon: "🎛️", titleKey: "featureTour.filters.title", bodyKey: "featureTour.filters.body" },
  { icon: "👩‍🍳", titleKey: "featureTour.cookMode.title", bodyKey: "featureTour.cookMode.body" },
  { icon: "⭐", titleKey: "featureTour.reviews.title", bodyKey: "featureTour.reviews.body" },
  { icon: "❤️", titleKey: "featureTour.saved.title", bodyKey: "featureTour.saved.body" },
  { icon: "📅", titleKey: "featureTour.mealPlan.title", bodyKey: "featureTour.mealPlan.body" },
  { icon: "🛒", titleKey: "featureTour.shopping.title", bodyKey: "featureTour.shopping.body" },
  { icon: "⚠️", titleKey: "featureTour.safety.title", bodyKey: "featureTour.safety.body" },
  { icon: "🔥", titleKey: "featureTour.streaks.title", bodyKey: "featureTour.streaks.body" },
  { icon: "🎨", titleKey: "featureTour.personalize.title", bodyKey: "featureTour.personalize.body" },
  { icon: "📖", titleKey: "featureTour.glossary.title", bodyKey: "featureTour.glossary.body" },
];

export function FeatureTourScreen({ navigation, route }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const textAlign = isRTL ? "right" : "left";
  const step = FEATURE_TOUR_STEPS[index];
  const isLast = index === FEATURE_TOUR_STEPS.length - 1;

  const finish = () => {
    if (route.params?.onFinishGoBack) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    }
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => Math.min(FEATURE_TOUR_STEPS.length - 1, i + 1));
    }
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.dotsRow}>
          {FEATURE_TOUR_STEPS.map((s, i) => (
            <View key={s.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <AnimatedPressable pressScale={0.92} onPress={finish} accessibilityRole="button">
          <Text style={styles.skip}>{t("featureTour.skip")}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.content}>
        <FadeSlideIn key={step.titleKey} style={styles.stepContent}>
          <Text style={styles.emoji}>{step.icon}</Text>
          <Text style={[styles.title, { textAlign }]}>{t(step.titleKey)}</Text>
          <Text style={[styles.body, { textAlign }]}>{t(step.bodyKey)}</Text>
        </FadeSlideIn>
      </View>

      <View style={styles.footer}>
        {index > 0 ? (
          <View style={styles.backButtonWrap}>
            <PrimaryButton label={t("featureTour.back")} variant="outline" onPress={back} />
          </View>
        ) : null}
        <View style={styles.nextButtonWrap}>
          <PrimaryButton label={isLast ? t("featureTour.getStarted") : t("featureTour.next")} onPress={next} />
        </View>
      </View>
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
      paddingHorizontal: spacing(3),
      paddingTop: spacing(1),
    },
    dotsRow: { flexDirection: "row" },
    dot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.chipBackground,
      marginEnd: spacing(0.75),
    },
    dotActive: { backgroundColor: colors.primary, width: 18 },
    skip: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
    content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(4) },
    stepContent: { width: "100%", alignItems: "center" },
    emoji: { fontSize: 64, marginBottom: spacing(3) },
    title: { fontSize: 24, fontWeight: "800", color: colors.text, width: "100%" },
    body: { fontSize: 15, color: colors.textMuted, marginTop: spacing(1.5), lineHeight: 22, width: "100%" },
    footer: { flexDirection: "row", gap: spacing(1.5), padding: spacing(3) },
    backButtonWrap: { flex: 1 },
    nextButtonWrap: { flex: 2 },
  });
