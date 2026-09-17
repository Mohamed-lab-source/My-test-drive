import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { apiErrorMessage } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useGoogleAuthRequest, isGoogleSignInConfigured } from "../auth/googleAuth";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const { signup, loginWithGoogle, savePreferences } = useAuth();
  const { preference } = useLocalPreference();
  const { t, isRTL } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [request, response, promptAsync] = useGoogleAuthRequest();

  const carryOverPreferences = async () => {
    if (preference.onboarded) {
      await savePreferences({
        dietGoal: preference.dietGoal,
        favoriteCuisineSlugs: preference.favoriteCuisineSlugs,
      });
    }
  };

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) return;
    setGoogleLoading(true);
    loginWithGoogle(idToken)
      .then(carryOverPreferences)
      .then(() => navigation.goBack())
      .catch((error) => Alert.alert(t("login.googleError"), apiErrorMessage(error)))
      .finally(() => setGoogleLoading(false));
  }, [response]);

  const submit = async () => {
    setLoading(true);
    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      await carryOverPreferences();
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("signup.error"), apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = () => {
    if (!isGoogleSignInConfigured()) {
      Alert.alert(t("login.googleUnavailable"));
      return;
    }
    promptAsync();
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={[styles.title, { textAlign }]}>{t("signup.title")}</Text>

          <Text style={[styles.label, { textAlign }]}>{t("signup.name")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={name}
            onChangeText={setName}
            placeholder={t("signup.namePlaceholder")}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { textAlign }]}>{t("signup.email")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { textAlign }]}>{t("signup.password")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t("signup.passwordPlaceholder")}
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.button}>
            <PrimaryButton
              label={t("signup.submit")}
              onPress={submit}
              loading={loading}
              disabled={!email || !password || !name}
            />
          </View>

          <Text style={styles.divider}>{t("login.or")}</Text>

          <PrimaryButton
            label={t("login.google")}
            onPress={submitGoogle}
            loading={googleLoading}
            disabled={!request}
            variant="outline"
          />

          <Pressable onPress={() => navigation.replace("Login")}>
            <Text style={styles.link}>{t("signup.switchToLogin")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing(3), justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: spacing(3) },
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
  divider: { textAlign: "center", color: colors.textMuted, marginVertical: spacing(2), fontSize: 12 },
  link: { color: colors.primary, fontWeight: "600", textAlign: "center", marginTop: spacing(2) },
});
