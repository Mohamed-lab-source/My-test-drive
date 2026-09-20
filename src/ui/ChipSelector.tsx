import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

export interface ChipOption {
  id: string;
  label: string;
  color?: string;
  icon?: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ChipSelector({ options, selectedId, onSelect }: ChipSelectorProps) {
  const { colors, typography, radius, spacing } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.md }}>
      {options.map((opt) => {
        const selected = opt.id === selectedId;
        const color = opt.color ?? colors.blue;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt.id);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: selected ? color : colors.fill,
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 8,
              marginRight: 8,
            }}
          >
            {opt.icon ? (
              <Icon name={opt.icon} size={14} color={selected ? '#fff' : colors.secondaryLabel} />
            ) : null}
            <Text
              style={[
                typography.subhead,
                { color: selected ? '#fff' : colors.label, marginLeft: opt.icon ? 6 : 0, fontWeight: selected ? '600' : '400' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
