import React, { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { CHANGELOG_ENTRIES } from "../data/changelog";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "WhatsNew">;

export function WhatsNewScreen({}: Props) {
  const { locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={CHANGELOG_ENTRIES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index}>
            <View style={styles.card}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={[styles.title, { textAlign }]}>{item.title[locale]}</Text>
              <Text style={[styles.body, { textAlign }]}>{item.body[locale]}</Text>
            </View>
          </FadeSlideIn>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing(3), paddingTop: spacing(2) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      marginBottom: spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
    },
    date: { fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: spacing(0.5) },
    title: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing(0.75) },
    body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  });
