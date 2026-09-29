import React, { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Scale to animate down to on press-in. iOS controls typically use 0.95-0.97. */
  pressScale?: number;
  /** Light haptic tick on press-in — set false for high-frequency taps (e.g. steppers already ticking per press is fine, but disable for decorative elements). */
  haptic?: boolean;
};

/**
 * Pressable with an iOS-style spring scale-down on press and a spring
 * bounce-back on release, plus an optional Taptic-style haptic tick.
 * Drop-in replacement for Pressable used across every tappable surface.
 */
export function AnimatedPressable({
  style,
  pressScale = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          animateTo(pressScale);
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
