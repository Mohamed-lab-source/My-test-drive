import React, { useMemo, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { GLOSSARY_TERMS } from "../data/glossary";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Glossary">;

export function GlossaryScreen({}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const textAlign = isRTL ? "right" : "left";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      (entry) =>
        entry.term[locale].toLowerCase().includes(q) ||
        entry.description[locale].toLowerCase().includes(q)
    );
  }, [query, locale]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, { textAlign }]}
          placeholder={t("glossary.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={[styles.term, { textAlign }]}>{item.term[locale]}</Text>
              </View>
              <Text style={[styles.description, { textAlign }]}>{item.description[locale]}</Text>
            </View>
          </FadeSlideIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t("glossary.empty")}</Text>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: spacing(3), paddingTop: spacing(2), paddingBottom: spacing(1) },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 15,
    },
    listContent: { padding: spacing(3), paddingTop: spacing(1) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      marginBottom: spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing(1) },
    emoji: { fontSize: 22, marginEnd: spacing(1.5) },
    term: { fontSize: 17, fontWeight: "800", color: colors.text, flex: 1 },
    description: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4) },
  });
