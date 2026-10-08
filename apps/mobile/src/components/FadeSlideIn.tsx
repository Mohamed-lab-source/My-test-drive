import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useAccessibilityPrefs } from "../context/AccessibilityPrefsContext";

type Props = {
  children: React.ReactNode;
  /** Stagger index — each step adds ~40ms of delay, capped so long lists don't feel sluggish. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

const STAGGER_MS = 40;
const MAX_DELAY_MS = 320;

/**
 * Fades and slides content up on mount, like the gentle ease-in iOS uses
 * when a list or screen's content appears. Pass `index` for a staggered
 * cascade across list items.
 */
export function FadeSlideIn({ children, index = 0, style }: Props) {
  const { reduceMotion } = useAccessibilityPrefs();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const delay = Math.min(index * STAGGER_MS, MAX_DELAY_MS);
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
