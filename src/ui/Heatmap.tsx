import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { todayKey } from '../db/client';

// A GitHub-style grid of the last `weeks * 7` days ending today, one row per
// week. `values` maps 'YYYY-MM-DD' to an intensity from 0 (none) to 1 (full).
export function Heatmap({ values, color, weeks = 5 }: { values: Record<string, number>; color: string; weeks?: number }) {
  const { colors, typography, spacing } = useTheme();
  const days = weeks * 7;
  const now = new Date();
  const keys = Array.from({ length: days }, (_, i) =>
    todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i)))
  );
  const rows = Array.from({ length: weeks }, (_, w) => keys.slice(w * 7, w * 7 + 7));

  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {row.map((key) => {
            const v = Math.max(0, Math.min(1, values[key] ?? 0));
            return (
              <View
                key={key}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  marginHorizontal: 2,
                  borderRadius: 4,
                  backgroundColor: v > 0 ? color : colors.fill,
                  opacity: v > 0 ? 0.25 + 0.75 * v : 1,
                }}
              />
            );
          })}
        </View>
      ))}
      <Text style={[typography.caption2, { color: colors.tertiaryLabel, marginTop: spacing.xxs }]}>
        Last {weeks} weeks · today is bottom right
      </Text>
    </View>
  );
}
