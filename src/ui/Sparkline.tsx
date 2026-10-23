import React, { useId, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';

// A smooth line with a soft fill underneath, like the Stocks app.
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    // Catmull-Rom to Bézier.
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }
  return d;
}

export function Sparkline({ values, color, height = 44, strokeWidth = 2 }: { values: number[]; color: string; height?: number; strokeWidth?: number }) {
  const [width, setWidth] = useState(0);
  const id = useId().replace(/:/g, '');
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = strokeWidth + 2;
  const points: [number, number][] = values.map((v, i) => [
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    pad + (1 - (v - min) / range) * (height - pad * 2),
  ]);
  const line = smoothPath(points);
  const last = points[points.length - 1];
  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#f${id})`} />
          <Path d={line} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={last[0] - 1} cy={last[1]} r={3.5} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}
