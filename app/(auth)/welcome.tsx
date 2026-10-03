import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { AuthBackground } from '../../src/features/auth/AuthBackground';
import { PrestigeButton } from '../../src/features/auth/PrestigeButton';

export default function WelcomeScreen() {
  const { typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <AuthBackground>
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Animated.View entering={ZoomIn.springify().damping(14).delay(80)}>
            <Image
              source={require('../../assets/icon.png')}
              style={{
                width: 96,
                height: 96,
                borderRadius: radius.xl,
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
              }}
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.springify().damping(16).delay(220)}
            style={[typography.largeTitle, { color: '#FFFFFF', marginTop: spacing.xl, textAlign: 'center' }]}
          >
            Anchor
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.springify().damping(16).delay(300)}
            style={[
              typography.body,
              { color: 'rgba(255,255,255,0.65)', marginTop: spacing.xs, textAlign: 'center', maxWidth: 280 },
            ]}
          >
            Everything that matters, held in one calm, private place.
          </Animated.Text>
        </View>

        <Animated.View
          entering={FadeInDown.springify().damping(18).delay(420)}
          style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
        >
          <PrestigeButton
            title="Create Account"
            onPress={() => router.push('/(auth)/create-account')}
          />
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/sign-in');
            }}
            style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[typography.headline, { color: '#FFFFFF' }]}>Sign In</Text>
          </Pressable>
        </Animated.View>
      </View>
    </AuthBackground>
  );
}
