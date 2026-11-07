import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ring({ progress, color, radius, stroke, center, delay }: { progress: number; color: string; radius: number; stroke: number; center: number; delay: number }) {
  const circumference = 2 * Math.PI * radius;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(Math.max(0, Math.min(1, progress)), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - p.value) }));
  return (
    <>
      <Circle cx={center} cy={center} r={radius} stroke={color} strokeOpacity={0.2} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={props}
      />
    </>
  );
}

// Concentric rings in the style of Apple Fitness, outermost first.
export function ActivityRings({ rings, size = 120, stroke = 14, gap = 3 }: { rings: { progress: number; color: string }[]; size?: number; stroke?: number; gap?: number }) {
  const center = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {rings.map((r, i) => (
          <Ring key={i} progress={r.progress} color={r.color} center={center} stroke={stroke} radius={center - stroke / 2 - i * (stroke + gap)} delay={i * 120} />
        ))}
      </Svg>
    </View>
  );
}
