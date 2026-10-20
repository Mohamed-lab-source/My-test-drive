import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { COOKING_BASICS, FOOD_STORAGE, SPICE_BLENDS } from "../data/kitchenGuides";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "KitchenGuides">;
type Tab = "basics" | "storage" | "spices";

export function KitchenGuidesScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>("basics");
  const [query, setQuery] = useState("");
  const textAlign = isRTL ? "right" : "left";

  const q = query.trim().toLowerCase();
  const storage = q
    ? FOOD_STORAGE.filter((s) => s.item.en.toLowerCase().includes(q) || s.item.ar.includes(query.trim()))
    : FOOD_STORAGE;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          <Chip label={t("guides.basics")} selected={tab === "basics"} onPress={() => setTab("basics")} />
          <Chip label={t("guides.storage")} selected={tab === "storage"} onPress={() => setTab("storage")} />
          <Chip label={t("guides.spices")} selected={tab === "spices"} onPress={() => setTab("spices")} />
        </View>

        {tab === "basics"
          ? COOKING_BASICS.map((g) => (
              <View key={g.title.en} style={styles.card}>
                <Text style={[styles.cardTitle, { textAlign }]}>
                  {g.emoji} {g.title[locale]}
                </Text>
                {g.steps.map((s, i) => (
                  <Text key={i} style={[styles.line, { textAlign }]}>
                    {i + 1}. {s[locale]}
                  </Text>
                ))}
              </View>
            ))
          : null}

        {tab === "storage" ? (
          <>
            <Text style={[styles.subtitle, { textAlign }]}>{t("guides.storageSubtitle")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              placeholder={t("guides.storageSearch")}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {storage.map((s) => (
              <View key={s.item.en} style={styles.card}>
                <Text style={[styles.cardTitle, { textAlign }]}>
                  {s.emoji} {s.item[locale]}
                </Text>
                <Text style={[styles.line, { textAlign }]}>{t("guides.fridge", { time: s.fridge[locale] })}</Text>
                <Text style={[styles.line, { textAlign }]}>{t("guides.freezer", { time: s.freezer[locale] })}</Text>
              </View>
            ))}
            {storage.length === 0 ? <Text style={[styles.subtitle, { textAlign }]}>{t("guides.noMatch")}</Text> : null}
            <Text style={[styles.note, { textAlign }]}>{t("guides.storageNote")}</Text>
          </>
        ) : null}

        {tab === "spices" ? (
          <>
            <Text style={[styles.subtitle, { textAlign }]}>{t("guides.spicesSubtitle")}</Text>
            {SPICE_BLENDS.map((b) => (
              <View key={b.name.en} style={styles.card}>
                <Text style={[styles.cardTitle, { textAlign }]}>
                  {b.emoji} {b.name[locale]}
                </Text>
                <Text style={[styles.use, { textAlign }]}>{t("guides.useFor", { use: b.use[locale] })}</Text>
                {b.parts.map((p, i) => (
                  <Text key={i} style={[styles.line, { textAlign }]}>
                    • {p[locale]}
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.buttonGap}>
          <PrimaryButton label={t("converter.title")} variant="outline" onPress={() => navigation.navigate("UnitConverter")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("glossary.title")} variant="outline" onPress={() => navigation.navigate("Glossary")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginBottom: spacing(1.5) },
    subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing(1) },
    note: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing(1) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.75),
      marginBottom: spacing(1.25),
    },
    cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing(0.75) },
    use: { fontSize: 12, fontWeight: "700", color: colors.secondary, marginBottom: spacing(0.75) },
    line: { fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 2 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: spacing(1.5),
    },
    buttonGap: { marginTop: spacing(1.25) },
  });
