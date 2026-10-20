import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  changeKey: string | number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Bounces its content with a quick spring "pop" whenever `changeKey` changes — used for numbers that update in place, like a servings counter. */
export function PopOnChange({ changeKey, children, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scale.setValue(1.3);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
  }, [changeKey]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
