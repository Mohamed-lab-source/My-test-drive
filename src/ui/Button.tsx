import React from 'react';
import { Text, Pressable, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon }: ButtonProps) {
  const { colors, typography, radius, spacing } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === 'primary'
      ? colors.blue
      : variant === 'destructive'
        ? colors.red
        : variant === 'secondary'
          ? colors.fill
          : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'destructive'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? colors.label
        : colors.blue;

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
        style={[
          styles.base,
          {
            backgroundColor: bg,
            borderRadius: radius.md,
            paddingVertical: variant === 'plain' ? spacing.xs : spacing.sm,
            paddingHorizontal: variant === 'plain' ? spacing.xs : spacing.lg,
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon}
            <Text style={[typography.headline, { color: textColor, marginLeft: icon ? 6 : 0 }]}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
