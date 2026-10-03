import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { AuthBackground } from '../../src/features/auth/AuthBackground';
import { PrestigeButton } from '../../src/features/auth/PrestigeButton';
import { GlassTextField } from '../../src/features/auth/GlassTextField';
import { Icon } from '../../src/ui/Icon';

export default function SignInScreen() {
  const { typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, busy, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    try {
      await signIn(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeIn.delay(60)} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 36, height: 36, justifyContent: 'center' }}>
              <Icon name="chevron.left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
            <Animated.Text entering={FadeInDown.springify().damping(16).delay(60)} style={[typography.title1, { color: '#FFFFFF' }]}>
              Welcome back
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.springify().damping(16).delay(120)}
              style={[typography.body, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xxs, marginBottom: spacing.xl }]}
            >
              Sign in to pick up right where you left off.
            </Animated.Text>

            <Animated.View entering={FadeInDown.springify().damping(16).delay(180)}>
              <GlassTextField
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) clearError();
                }}
              />
            </Animated.View>
            <Animated.View entering={FadeInDown.springify().damping(16).delay(240)}>
              <GlassTextField
                placeholder="Password"
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) clearError();
                }}
              />
            </Animated.View>

            {error ? (
              <Animated.Text entering={FadeIn} style={[typography.footnote, { color: '#FF6961', marginBottom: spacing.sm }]}>
                {error}
              </Animated.Text>
            ) : null}

            <Animated.View entering={FadeInDown.springify().damping(16).delay(300)} style={{ marginTop: spacing.sm }}>
              <PrestigeButton title="Sign In" onPress={handleSignIn} disabled={!canSubmit} loading={busy} />
            </Animated.View>
          </View>

          <Animated.View
            entering={FadeIn.delay(400)}
            style={{ flexDirection: 'row', justifyContent: 'center', paddingBottom: spacing.md }}
          >
            <Text style={[typography.subhead, { color: 'rgba(255,255,255,0.6)' }]}>Don&rsquo;t have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/create-account')}>
              <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>Create one</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}
