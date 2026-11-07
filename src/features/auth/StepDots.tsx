import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 22 : 7, { damping: 16, stiffness: 220 }),
    opacity: withSpring(active ? 1 : 0.35, { damping: 16, stiffness: 220 }),
  }));

  return (
    <Animated.View
      style={[
        { height: 7, borderRadius: 4, backgroundColor: '#FFFFFF', marginHorizontal: 3 },
        style,
      ]}
    />
  );
}

export function StepDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} active={i === activeIndex} />
      ))}
    </View>
  );
}
