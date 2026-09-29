import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Set false to freeze the pulse (e.g. streak at 0) without unmounting. */
  active?: boolean;
};

/**
 * A gentle, continuous breathing scale — used to draw a little extra
 * attention to a live badge (like an active streak) without being
 * distracting. Purely Animated-API, no extra native deps.
 */
export function Pulse({ children, style, active = true }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
