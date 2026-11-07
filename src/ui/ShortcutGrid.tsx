import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GradientCard } from './GradientCard';
import { PressableScale } from './PressableScale';
import { Icon } from './Icon';
import { shade } from '../theme/shade';

export interface Shortcut {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

// Tiles in the style of the Shortcuts app: a rich gradient, a white symbol
// in the corner and the name along the bottom.
export function ShortcutGrid({ items, columns = 3 }: { items: Shortcut[]; columns?: number }) {
  const { typography, radius, spacing, shadow } = useTheme();
  const rows: Shortcut[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  const gap = spacing.sm + 2;
  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', marginBottom: gap }}>
          {Array.from({ length: columns }, (_, c) => {
            const item = row[c];
            return (
              <View key={c} style={{ flex: 1, marginLeft: c ? gap : 0 }}>
                {item ? (
                  <PressableScale onPress={item.onPress} scaleTo={0.94}>
                    <GradientCard
                      colors={[shade(item.color, 0.1), shade(item.color, -0.3)]}
                      style={[{ height: 92, padding: 12, borderRadius: radius.lg, justifyContent: 'space-between' }, shadow.card]}
                    >
                      <Icon name={item.icon} size={24} color="#FFFFFF" />
                      <Text style={[typography.footnote, { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </GradientCard>
                  </PressableScale>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
