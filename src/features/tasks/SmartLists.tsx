import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PressableScale } from '../../ui/PressableScale';
import { Icon } from '../../ui/Icon';

export interface SmartList {
  index: number;
  label: string;
  icon: string;
  color: string;
  count: number;
}

// The Reminders app's smart-list tiles: a coloured symbol, a big count and
// the list's name. The selected list fills with its colour.
export function SmartLists({ lists, selected, onSelect, columns = 2 }: { lists: SmartList[]; selected: number; onSelect: (i: number) => void; columns?: number }) {
  const { colors, typography, radius, spacing, shadow } = useTheme();
  const rows: SmartList[][] = [];
  for (let i = 0; i < lists.length; i += columns) rows.push(lists.slice(i, i + columns));
  const compact = columns > 2;
  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', marginBottom: spacing.sm + 2 }}>
          {row.map((l, i) => {
            const on = l.index === selected;
            return (
              <React.Fragment key={l.label}>
                {i > 0 ? <View style={{ width: spacing.sm + 2 }} /> : null}
                <PressableScale
                  onPress={() => onSelect(l.index)}
                  scaleTo={0.95}
                  style={[
                    {
                      flex: 1,
                      borderRadius: radius.lg,
                      borderCurve: 'continuous',
                      padding: compact ? 10 : 12,
                      backgroundColor: on ? l.color : colors.secondarySystemGroupedBackground,
                    },
                    shadow.card,
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: compact ? 28 : 34,
                        height: compact ? 28 : 34,
                        borderRadius: compact ? 14 : 17,
                        backgroundColor: on ? 'rgba(255,255,255,0.25)' : l.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={l.icon} size={compact ? 15 : 18} color="#FFFFFF" />
                    </View>
                    <Text style={[compact ? typography.title2 : typography.title1, { color: on ? '#FFFFFF' : colors.label, fontVariant: ['tabular-nums'] }]}>{l.count}</Text>
                  </View>
                  <Text style={[compact ? typography.subhead : typography.headline, { color: on ? '#FFFFFF' : colors.secondaryLabel, marginTop: compact ? 6 : 8, fontWeight: '600' }]} numberOfLines={1}>
                    {l.label}
                  </Text>
                </PressableScale>
              </React.Fragment>
            );
          })}
          {Array.from({ length: columns - row.length }, (_, k) => (
            <React.Fragment key={`pad${k}`}>
              <View style={{ width: spacing.sm + 2 }} />
              <View style={{ flex: 1 }} />
            </React.Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}
