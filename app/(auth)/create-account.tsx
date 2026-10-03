import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { AuthBackground } from '../../src/features/auth/AuthBackground';
import { PrestigeButton } from '../../src/features/auth/PrestigeButton';
import { GlassTextField } from '../../src/features/auth/GlassTextField';
import { StepDots } from '../../src/features/auth/StepDots';
import { Icon } from '../../src/ui/Icon';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 3;
// How long the success step celebrates locally before the account is
// actually created. Signing up flips global auth status to "signed in"
// almost instantly, which triggers an app-wide redirect to the main app —
// doing the real signUp() only after this delay is what keeps the
// celebration on screen for its full length instead of being cut short.
const CELEBRATION_MS = 1100;

export default function CreateAccountScreen() {
  const { typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, error, clearError } = useAuth();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [celebrating, setCelebrating] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  const goTo = (next: number, dir: 'forward' | 'back') => {
    setStepError(null);
    if (error) clearError();
    setDirection(dir);
    setStep(next);
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
    } else {
      goTo(step - 1, 'back');
    }
  };

  const handleContinue = async () => {
    if (step === 0) {
      if (name.trim().length === 0) {
        setStepError('Tell us what to call you.');
        return;
      }
      goTo(1, 'forward');
      return;
    }
    if (step === 1) {
      if (!EMAIL_RE.test(email.trim())) {
        setStepError('That doesn’t look like a valid email.');
        return;
      }
      goTo(2, 'forward');
      return;
    }
    if (step === 2) {
      if (password.length < 6) {
        setStepError('Use at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setStepError('Passwords don’t match.');
        return;
      }
      setStepError(null);
      setCelebrating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        await Promise.all([
          new Promise((resolve) => setTimeout(resolve, CELEBRATION_MS)),
          signUp(email, password, name),
        ]);
        // On success, the root layout's auth redirect takes it from here.
      } catch {
        setCelebrating(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  if (celebrating) {
    return (
      <AuthBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Animated.View
            entering={ZoomIn.springify().damping(12)}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: 'rgba(48,209,88,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="checkmark.circle.fill" size={56} color="#30D158" />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.springify().delay(150)}
            style={[typography.title2, { color: '#FFFFFF', marginTop: spacing.xl, textAlign: 'center' }]}
          >
            Welcome, {name.trim().split(' ')[0]}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.springify().delay(220)}
            style={[typography.body, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xxs, textAlign: 'center' }]}
          >
            Your account is ready.
          </Animated.Text>
        </View>
      </AuthBackground>
    );
  }

  const enteringAnim = direction === 'forward' ? SlideInRight.springify().damping(18) : SlideInLeft.springify().damping(18);
  const exitingAnim = direction === 'forward' ? SlideOutLeft : SlideOutRight;

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={handleBack} hitSlop={12} style={{ width: 36, height: 36, justifyContent: 'center' }}>
              <Icon name="chevron.left" size={22} color="#FFFFFF" />
            </Pressable>
            <StepDots count={STEP_COUNT} activeIndex={step} />
            <View style={{ width: 36 }} />
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center', overflow: 'hidden' }}>
          {step === 0 ? (
            <Animated.View key="step-0" entering={enteringAnim} exiting={exitingAnim}>
              <Text style={[typography.title1, { color: '#FFFFFF' }]}>What should we call you?</Text>
              <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xxs, marginBottom: spacing.xl }]}>
                This is how Anchor will greet you.
              </Text>
              <GlassTextField
                placeholder="Your name"
                autoCapitalize="words"
                autoFocus
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setStepError(null);
                }}
                onSubmitEditing={handleContinue}
                returnKeyType="next"
              />
            </Animated.View>
          ) : null}

          {step === 1 ? (
            <Animated.View key="step-1" entering={enteringAnim} exiting={exitingAnim}>
              <Text style={[typography.title1, { color: '#FFFFFF' }]}>What&rsquo;s your email?</Text>
              <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xxs, marginBottom: spacing.xl }]}>
                We&rsquo;ll use this to sign you in.
              </Text>
              <GlassTextField
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoFocus
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setStepError(null);
                }}
                onSubmitEditing={handleContinue}
                returnKeyType="next"
              />
            </Animated.View>
          ) : null}

          {step === 2 ? (
            <Animated.View key="step-2" entering={enteringAnim} exiting={exitingAnim}>
              <Text style={[typography.title1, { color: '#FFFFFF' }]}>Create a password</Text>
              <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xxs, marginBottom: spacing.xl }]}>
                At least 6 characters.
              </Text>
              <GlassTextField
                placeholder="Password"
                secureTextEntry
                autoFocus
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setStepError(null);
                }}
                returnKeyType="next"
              />
              <GlassTextField
                placeholder="Confirm password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setStepError(null);
                }}
                onSubmitEditing={handleContinue}
                returnKeyType="done"
              />
            </Animated.View>
          ) : null}

          {stepError || error ? (
            <Animated.Text entering={FadeIn} style={[typography.footnote, { color: '#FF6961', marginTop: spacing.xs }]}>
              {stepError ?? error}
            </Animated.Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
          <PrestigeButton title={step === 2 ? 'Create Account' : 'Continue'} onPress={handleContinue} />
        </View>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}
