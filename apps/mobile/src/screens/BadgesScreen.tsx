import React, { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { FadeSlideIn } from "../components/FadeSlideIn";
import { useBadges } from "../context/BadgesContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Badges">;

export function BadgesScreen({}: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { badges, unlockedCount } = useBadges();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={badges}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <Text style={[styles.subtitle, { textAlign }]}>
            {t("badges.subtitle", { unlocked: unlockedCount, total: badges.length })}
          </Text>
        }
        renderItem={({ item, index }) => (
          <FadeSlideIn index={index} style={styles.cardWrap}>
            <View style={[styles.card, !item.unlocked && styles.cardLocked]}>
              <Text style={[styles.emoji, !item.unlocked && styles.emojiLocked]}>{item.emoji}</Text>
              <Text style={[styles.title, { textAlign: "center" }, !item.unlocked && styles.titleLocked]}>
                {t(item.titleKey)}
              </Text>
              <Text style={[styles.description, { textAlign: "center" }]}>{t(item.descriptionKey)}</Text>
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
    listContent: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, marginBottom: spacing(2), lineHeight: 20 },
    row: { gap: spacing(1.5) },
    cardWrap: { flex: 1, marginBottom: spacing(1.5) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(2),
      alignItems: "center",
    },
    cardLocked: { opacity: 0.45 },
    emoji: { fontSize: 36, marginBottom: spacing(1) },
    emojiLocked: { opacity: 0.6 },
    title: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 4 },
    titleLocked: { color: colors.textMuted },
    description: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  });
