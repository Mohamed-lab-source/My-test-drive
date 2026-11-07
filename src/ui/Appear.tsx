import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

// Sections rise into place one after another when a screen first appears.
// Driven by a plain style animation (not a layout animation), so the view
// keeps its normal place in the layout the whole time.
export function Appear({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    const delay = Math.min(index, 10) * 55;
    progress.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 170, mass: 0.9 }));
  }, []);
  const animated = useAnimatedStyle(() => ({
    opacity: withTiming(progress.value > 0.01 ? 1 : 0, { duration: 260, easing: Easing.out(Easing.quad) }),
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.985 + progress.value * 0.015 }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
