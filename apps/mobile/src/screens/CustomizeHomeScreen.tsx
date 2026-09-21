import React, { useMemo } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { HOME_SECTION_KEYS, useHomeLayout, type HomeSectionKey } from "../context/HomeLayoutContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { spacing, type ThemeColors } from "../theme";
import type { TranslationKey } from "../i18n/translations";

type Props = NativeStackScreenProps<RootStackParamList, "CustomizeHome">;

const SECTION_LABEL_KEYS: Record<HomeSectionKey, TranslationKey> = {
  recipeOfDay: "customizeHome.recipeOfDay",
  browseByMealType: "customizeHome.browseByMealType",
  leftovers: "customizeHome.leftovers",
  recentlyViewed: "customizeHome.recentlyViewed",
};

export function CustomizeHomeScreen({}: Props) {
  const { isVisible, toggleSection } = useHomeLayout();
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={[styles.subtitle, { textAlign }]}>{t("customizeHome.subtitle")}</Text>
        {HOME_SECTION_KEYS.map((key) => (
          <View key={key} style={styles.row}>
            <Text style={[styles.rowLabel, { textAlign }]}>{t(SECTION_LABEL_KEYS[key])}</Text>
            <Switch
              value={isVisible(key)}
              onValueChange={() => toggleSection(key)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3) },
    subtitle: { color: colors.textMuted, marginBottom: spacing(3), lineHeight: 20 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.75),
      marginBottom: spacing(1.25),
    },
    rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600", flex: 1, marginEnd: spacing(1) },
  });
