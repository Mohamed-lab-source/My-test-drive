import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// A compact labelled bar chart. `max` pins the scale (e.g. a daily goal);
// otherwise the tallest bar fills the height.
export function MiniBars({
  data,
  color,
  height = 70,
  max,
  highlightLast = true,
}: {
  data: { key: string; label: string; value: number }[];
  color: string;
  height?: number;
  max?: number;
  highlightLast?: boolean;
}) {
  const { colors, typography } = useTheme();
  const top = Math.max(1, max ?? 0, ...data.map((d) => d.value));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
        {data.map((d, i) => (
          <View key={d.key} style={{ flex: 1, alignItems: 'center', height, justifyContent: 'flex-end' }}>
            {/* A faint full-height track behind each bar, as in Health. */}
            <View style={{ position: 'absolute', top: 0, bottom: 0, width: '56%', borderRadius: 7, backgroundColor: colors.quaternaryFill }} />
            <View
              style={{
                width: '56%',
                borderRadius: 7,
                borderCurve: 'continuous',
                height: d.value > 0 ? Math.max(8, (Math.min(d.value, top) / top) * height) : 0,
                backgroundColor: color,
                opacity: highlightLast && i !== data.length - 1 ? 0.55 : 1,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((d) => (
          <Text key={d.key} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.secondaryLabel, fontWeight: '600' }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// The last `n` local days as { key, label } pairs, oldest first.
export function lastDays(n: number, todayKeyFn: (d: Date) => string): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i));
    return { key: todayKeyFn(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });
}
