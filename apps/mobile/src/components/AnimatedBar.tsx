import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

type Props = {
  targetHeight: number;
  color: string;
  delay?: number;
  style?: object;
};

/** A single bar that grows in from 0 -- used by the cooking-stats chart. */
export function AnimatedBar({ targetHeight, color, delay = 0, style }: Props) {
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(height, {
      toValue: targetHeight,
      duration: 420,
      delay,
      useNativeDriver: false,
    }).start();
  }, [targetHeight, delay, height]);

  return <Animated.View style={[style, { height, backgroundColor: color }]} />;
}
