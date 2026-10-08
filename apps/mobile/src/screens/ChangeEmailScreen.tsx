import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChangeEmail">;

export function ChangeEmailScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const { changeEmail } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  const submit = async () => {
    setLoading(true);
    try {
      await changeEmail(currentPassword, newEmail.trim());
      Alert.alert(t("changeEmail.success"));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("changeEmail.error"), apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={[styles.label, { textAlign }]}>{t("changeEmail.newEmail")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { textAlign }]}>{t("changeEmail.currentPassword")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.button}>
            <PrimaryButton
              label={t("changeEmail.submit")}
              onPress={submit}
              loading={loading}
              disabled={!currentPassword || !newEmail.trim()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { flex: 1, padding: spacing(3), paddingTop: spacing(4) },
    label: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing(2), marginBottom: spacing(0.5) },
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
    button: { marginTop: spacing(3) },
  });
