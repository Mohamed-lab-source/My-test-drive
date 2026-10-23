import React, { useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, RadialGradient } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

// A Wallet-style card: a diagonal gradient with a soft highlight in the
// top corner. Content sits on top in white.
export function GradientCard({
  colors: stops,
  style,
  children,
}: {
  colors: [string, string];
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { radius, spacing, shadow } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const id = useId().replace(/:/g, '');
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View onLayout={onLayout} style={[{ borderRadius: radius.xl, borderCurve: 'continuous', overflow: 'hidden', padding: spacing.lg }, shadow.floating, style]}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={stops[0]} />
              <Stop offset="1" stopColor={stops[1]} />
            </LinearGradient>
            <RadialGradient id={`h${id}`} cx="0.15" cy="0" r="0.9">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#g${id})`} />
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#h${id})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
