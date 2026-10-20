import React, { useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { Chip } from "./Chip";
import { PrimaryButton } from "./PrimaryButton";
import { reportRecipe } from "../api/endpoints";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";
import type { ReportReason } from "../api/types";

const REASONS: ReportReason[] = ["WRONG_INGREDIENTS", "WRONG_STEPS", "WRONG_NUTRITION", "TRANSLATION", "OTHER"];
const MAX_DETAILS = 500;

type Props = { visible: boolean; slug: string; onClose: () => void };

/** "Something's wrong with this recipe" -- sent to the server for the team to fix. */
export function ReportRecipeModal({ visible, slug, onClose }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  const close = () => {
    setReason(null);
    setDetails("");
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await reportRecipe(slug, reason, details.trim());
      close();
      showToast(t("report.thanks"));
    } catch {
      Alert.alert(t("report.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={[styles.title, { textAlign }]}>{t("report.title")}</Text>
          <Text style={[styles.subtitle, { textAlign }]}>{t("report.subtitle")}</Text>
          <View style={styles.chipRow}>
            {REASONS.map((r) => (
              <Chip
                key={r}
                label={t(`report.reason.${r}` as TranslationKey)}
                selected={reason === r}
                onPress={() => setReason(r)}
              />
            ))}
          </View>
          <TextInput
            style={[styles.input, { textAlign }]}
            placeholder={t("report.detailsPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={details}
            onChangeText={(v) => setDetails(v.slice(0, MAX_DETAILS))}
            multiline
          />
          <PrimaryButton label={t("report.send")} onPress={submit} loading={sending} disabled={!reason} />
          <AnimatedPressable style={styles.cancel} pressScale={0.95} onPress={close}>
            <Text style={styles.cancelText}>{t("home.cancel")}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing(3),
      paddingBottom: spacing(4),
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing(0.5), marginBottom: spacing(1.5), lineHeight: 19 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing(1.25),
      minHeight: 80,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      marginVertical: spacing(1.5),
      textAlignVertical: "top",
    },
    cancel: { alignSelf: "center", marginTop: spacing(1.5) },
    cancelText: { color: colors.textMuted, fontWeight: "700" },
  });
