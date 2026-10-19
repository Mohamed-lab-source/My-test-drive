import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { TimerTray } from "../components/TimerTray";
import { useKitchenTimers } from "../context/KitchenTimersContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "KitchenTimer">;

const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];
const MAX_MINUTES = 600;

export function KitchenTimerScreen({}: Props) {
  useKeepAwake();
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { timers, start } = useKitchenTimers();
  const [label, setLabel] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const textAlign = isRTL ? "right" : "left";

  const launch = (minutes: number) => {
    start(label.trim() || t("timers.defaultLabel", { minutes }), minutes);
    setLabel("");
    setCustomMinutes("");
  };

  const parsedCustom = Number(customMinutes);
  const customValid = Number.isFinite(parsedCustom) && parsedCustom > 0 && parsedCustom <= MAX_MINUTES;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { textAlign }]}>{t("timers.subtitle")}</Text>
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={t("timers.labelPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={label}
          onChangeText={setLabel}
        />
        <View style={styles.chipRow}>
          {PRESETS.map((m) => (
            <Chip key={m} label={t("timers.preset", { minutes: m })} onPress={() => launch(m)} />
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, styles.flex1, { textAlign }]}
            placeholder={t("timers.customPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={customMinutes}
            onChangeText={setCustomMinutes}
          />
          <View style={styles.flex1}>
            <PrimaryButton label={t("timers.startCustom")} disabled={!customValid} onPress={() => launch(parsedCustom)} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("timers.running", { count: timers.length })}</Text>
        {timers.length === 0 ? <Text style={[styles.muted, { textAlign }]}>{t("timers.none")}</Text> : <TimerTray />}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(2) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginTop: spacing(1.5) },
    customRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginTop: spacing(2) },
    flex1: { flex: 1 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
    muted: { color: colors.textMuted },
  });
