import React from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';

// The high-contrast white pill CTA used throughout the auth flow — a
// deliberately different look from the app's own Button (which is tuned for
// the light/dark system palette), matching the always-dark auth backdrop.
export function PrestigeButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { typography, radius } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled || loading}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={{
          height: 54,
          borderRadius: radius.md,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <Text style={[typography.headline, { color: '#000000' }]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
