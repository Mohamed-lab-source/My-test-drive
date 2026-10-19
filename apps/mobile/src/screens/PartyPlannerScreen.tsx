import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PopOnChange } from "../components/PopOnChange";
import { PrimaryButton } from "../components/PrimaryButton";
import { useHousehold } from "../context/HouseholdContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { isKidFriendly } from "../utils/kidFriendly";
import { shareViaWhatsApp } from "../utils/whatsapp";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";
import type { RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "PartyPlanner">;

type Course = "starter" | "main" | "side" | "dessert";

const COURSES: { key: Course; emoji: string; dishTypes: string[] }[] = [
  { key: "starter", emoji: "🥟", dishTypes: ["Appetizer", "Soup"] },
  { key: "main", emoji: "🍖", dishTypes: ["Main Course", "Pasta", "Rice", "Stir-fry", "Noodles", "Pizza"] },
  { key: "side", emoji: "🥗", dishTypes: ["Side Dish", "Salad", "Bread"] },
  { key: "dessert", emoji: "🍰", dishTypes: ["Dessert"] },
];
const MIN_GUESTS = 2;
const MAX_GUESTS = 60;

function randomFrom<T>(items: T[], avoid?: T): T | undefined {
  const pool = items.length > 1 && avoid ? items.filter((i) => i !== avoid) : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function PartyPlannerScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { members } = useHousehold();
  const [catalog, setCatalog] = useState<RecipeSummary[] | null>(null);
  const [guests, setGuests] = useState(8);
  const [vegetarian, setVegetarian] = useState(false);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [picks, setPicks] = useState<Partial<Record<Course, RecipeSummary>>>({});
  const textAlign = isRTL ? "right" : "left";
  const familyAllergens = useMemo(() => new Set(members.flatMap((m) => m.allergies)), [members]);

  useEffect(() => {
    fetchRecipes({})
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, [locale]);

  const poolFor = (course: Course) => {
    const dishTypes = COURSES.find((c) => c.key === course)?.dishTypes ?? [];
    return (catalog ?? []).filter(
      (r) =>
        dishTypes.includes(r.dishType) &&
        !r.allergens.some((a) => familyAllergens.has(a)) &&
        (!vegetarian || r.tags.includes("VEGETARIAN")) &&
        (!kidFriendly || isKidFriendly(r))
    );
  };

  // Re-deal the whole menu whenever the catalog or the filters change.
  useEffect(() => {
    if (!catalog) return;
    const next: Partial<Record<Course, RecipeSummary>> = {};
    for (const c of COURSES) next[c.key] = randomFrom(poolFor(c.key));
    setPicks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, vegetarian, kidFriendly, familyAllergens]);

  const reshuffle = (course: Course) =>
    setPicks((prev) => ({ ...prev, [course]: randomFrom(poolFor(course), prev[course]) }));

  const chosen = COURSES.map((c) => ({ course: c, recipe: picks[c.key] })).filter(
    (x): x is { course: (typeof COURSES)[number]; recipe: RecipeSummary } => !!x.recipe
  );
  const totalCost = chosen.reduce((sum, x) => sum + x.recipe.costPerServing * guests, 0);
  const kcalPerGuest = chosen.reduce((sum, x) => sum + x.recipe.caloriesPerServing, 0);
  const totalMinutes = chosen.reduce((sum, x) => sum + x.recipe.prepMinutes + x.recipe.cookMinutes, 0);

  const shareMenu = () =>
    shareViaWhatsApp(
      [
        t("party.shareTitle", { guests }),
        "",
        ...chosen.map((x) => `${x.course.emoji} ${t(`party.course.${x.course.key}` as TranslationKey)}: ${x.recipe.title}`),
        "",
        t("party.totals", { cost: Math.round(totalCost), perGuest: Math.round(totalCost / guests), kcal: kcalPerGuest }),
        t("share.branding"),
      ].join("\n")
    );

  if (catalog === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { textAlign }]}>{t("party.subtitle")}</Text>

        <Text style={[styles.label, { textAlign }]}>{t("party.guests")}</Text>
        <View style={styles.stepperRow}>
          <AnimatedPressable
            style={styles.stepperButton}
            pressScale={0.88}
            onPress={() => setGuests((g) => Math.max(MIN_GUESTS, g - 1))}
            accessibilityLabel={t("recipeDetail.fewerPeople")}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </AnimatedPressable>
          <PopOnChange changeKey={guests}>
            <Text style={styles.stepperValue}>{guests}</Text>
          </PopOnChange>
          <AnimatedPressable
            style={styles.stepperButton}
            pressScale={0.88}
            onPress={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
            accessibilityLabel={t("recipeDetail.morePeople")}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.chipRow}>
          <Chip label={t("recipeList.filter.vegetarian")} selected={vegetarian} onPress={() => setVegetarian((v) => !v)} />
          <Chip label={t("recipeList.filter.kidFriendly")} selected={kidFriendly} onPress={() => setKidFriendly((v) => !v)} />
        </View>
        {familyAllergens.size > 0 ? (
          <Text style={[styles.note, { textAlign }]}>{t("lunchbox.allergySafe")}</Text>
        ) : null}

        {COURSES.map((course) => {
          const recipe = picks[course.key];
          return (
            <View key={course.key} style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <Text style={styles.courseLabel}>
                  {course.emoji} {t(`party.course.${course.key}` as TranslationKey)}
                </Text>
                {recipe ? (
                  <AnimatedPressable pressScale={0.9} onPress={() => reshuffle(course.key)} accessibilityRole="button">
                    <Text style={styles.link}>{t("party.swap")}</Text>
                  </AnimatedPressable>
                ) : null}
              </View>
              {recipe ? (
                <AnimatedPressable
                  pressScale={0.98}
                  onPress={() => navigation.navigate("RecipeDetail", { slug: recipe.slug })}
                >
                  <Text style={[styles.recipeTitle, { textAlign }]}>
                    {CUISINE_EMOJI[recipe.cuisine.slug] ?? "🍽️"} {recipe.title}
                  </Text>
                  <Text style={[styles.recipeMeta, { textAlign }]}>
                    {t("party.courseMeta", {
                      minutes: recipe.prepMinutes + recipe.cookMinutes,
                      cost: Math.round(recipe.costPerServing * guests),
                      kcal: recipe.caloriesPerServing,
                    })}
                  </Text>
                </AnimatedPressable>
              ) : (
                <Text style={[styles.recipeMeta, { textAlign }]}>{t("party.noMatch")}</Text>
              )}
            </View>
          );
        })}

        {chosen.length > 0 ? (
          <View style={styles.totalsCard}>
            <Text style={styles.totalsMain}>{t("party.totalCost", { cost: Math.round(totalCost) })}</Text>
            <Text style={styles.totalsSub}>
              {t("party.totalsDetail", {
                perGuest: Math.round(totalCost / guests),
                kcal: kcalPerGuest,
                minutes: totalMinutes,
              })}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonGap}>
          <PrimaryButton label={t("party.share")} onPress={shareMenu} disabled={chosen.length === 0} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: spacing(2.5), marginBottom: spacing(1) },
    stepperRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing(1.5) },
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
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    note: { color: colors.success, fontWeight: "700", fontSize: 12, marginTop: spacing(1) },
    courseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginTop: spacing(1.5),
    },
    courseHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    courseLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted },
    link: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    recipeTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: spacing(0.75) },
    recipeMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    totalsCard: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(2),
      marginTop: spacing(2),
      alignItems: "center",
    },
    totalsMain: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    totalsSub: { fontSize: 12, color: colors.textMuted, marginTop: spacing(0.5), textAlign: "center" },
    buttonGap: { marginTop: spacing(2) },
  });
