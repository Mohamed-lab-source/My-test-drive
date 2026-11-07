import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  // How far it shrinks while held (iOS uses a subtle ~3%).
  scaleTo?: number;
  haptic?: 'light' | 'selection' | 'none';
}

// The springy press-down iOS uses for tappable cards and tiles.
export function PressableScale({ style, scaleTo = 0.97, haptic = 'selection', onPressIn, onPressOut, onPress, children, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      onPress={
        onPress
          ? (e) => {
              if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              else if (haptic === 'selection') Haptics.selectionAsync();
              onPress(e);
            }
          : undefined
      }
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
