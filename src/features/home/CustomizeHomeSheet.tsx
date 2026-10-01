import React from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { HOME_CARDS } from './homeCards';

export function CustomizeHomeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { hiddenHomeCards, toggleHomeCard } = useSettingsStore();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Customize Home</Text>
        {HOME_CARDS.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
            <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{c.label}</Text>
            <Switch value={!hiddenHomeCards.includes(c.id)} onValueChange={() => toggleHomeCard(c.id)} />
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}
