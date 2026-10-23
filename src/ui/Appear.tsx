import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Sections rise into place one after another when a screen first appears.
export function Appear({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 45)
        .duration(420)
        .springify()
        .damping(20)
        .stiffness(180)
        .withInitialValues({ transform: [{ translateY: 14 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
