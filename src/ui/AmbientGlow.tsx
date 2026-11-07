import React, { useId } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

// A soft wash of colour behind a screen's title, like the tinted
// backgrounds of iOS 26 and visionOS. Two overlapping glows, each fading
// to nothing, so the page still reads as plain grouped background.
export function AmbientGlow({ colors: tints, height = 420 }: { colors: [string, string]; height?: number }) {
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const id = useId().replace(/:/g, '');
  const strength = scheme === 'dark' ? 0.42 : 0.26;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`a${id}`} cx="0.12" cy="0.05" rx="0.95" ry="0.75" fx="0.12" fy="0.05">
            <Stop offset="0" stopColor={tints[0]} stopOpacity={strength} />
            <Stop offset="1" stopColor={tints[0]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`b${id}`} cx="0.95" cy="0.15" rx="0.8" ry="0.65" fx="0.95" fy="0.15">
            <Stop offset="0" stopColor={tints[1]} stopOpacity={strength * 0.85} />
            <Stop offset="1" stopColor={tints[1]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#a${id})`} />
        <Rect x="0" y="0" width={width} height={height} fill={`url(#b${id})`} />
      </Svg>
    </View>
  );
}
