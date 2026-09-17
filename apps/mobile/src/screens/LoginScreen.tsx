import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLocale } from "../i18n/LocaleContext";
import { useGoogleAuthRequest, isGoogleSignInConfigured } from "../auth/googleAuth";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login, loginWithGoogle } = useAuth();
  const { t, isRTL } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [request, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) return;
    setGoogleLoading(true);
    loginWithGoogle(idToken)
      .then(() => navigation.goBack())
      .catch((error) => Alert.alert(t("login.googleError"), apiErrorMessage(error)))
      .finally(() => setGoogleLoading(false));
  }, [response]);

  const submit = async () => {
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("login.error"), apiErrorMessage(error));
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
          <Text style={[styles.title, { textAlign }]}>{t("login.title")}</Text>

          <Text style={[styles.label, { textAlign }]}>{t("login.email")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { textAlign }]}>{t("login.password")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.button}>
            <PrimaryButton label={t("login.submit")} onPress={submit} loading={loading} disabled={!email || !password} />
          </View>

          <Text style={styles.divider}>{t("login.or")}</Text>

          <PrimaryButton
            label={t("login.google")}
            onPress={submitGoogle}
            loading={googleLoading}
            disabled={!request}
            variant="outline"
          />

          <Pressable onPress={() => navigation.replace("Signup")}>
            <Text style={styles.link}>{t("login.switchToSignup")}</Text>
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
