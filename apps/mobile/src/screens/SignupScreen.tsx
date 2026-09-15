import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useLocalPreference } from "../context/LocalPreferenceContext";
import { apiErrorMessage } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const { signup, savePreferences } = useAuth();
  const { preference } = useLocalPreference();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      // Carry over onboarding preferences captured before the user had an account.
      if (preference.onboarded) {
        await savePreferences({
          dietGoal: preference.dietGoal,
          favoriteCuisineSlugs: preference.favoriteCuisineSlugs,
        });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't create account", apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.button}>
            <PrimaryButton
              label="Sign up"
              onPress={submit}
              loading={loading}
              disabled={!email || !password || !name}
            />
          </View>

          <Pressable onPress={() => navigation.replace("Login")}>
            <Text style={styles.link}>Already have an account? Log in</Text>
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
  link: { color: colors.primary, fontWeight: "600", textAlign: "center", marginTop: spacing(2) },
});
