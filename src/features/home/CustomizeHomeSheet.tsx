import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Switch } from '../../ui/Switch';
import { Sheet } from '../../ui/Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { HOME_CARDS, QUICK_ACTIONS } from './homeCards';

export function CustomizeHomeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { hiddenHomeCards, toggleHomeCard, homeQuickActions, setHomeQuickActions } = useSettingsStore();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Customize Home</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Quick actions · {homeQuickActions.length} of 4
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs }}>
          {QUICK_ACTIONS.map((q) => {
            const on = homeQuickActions.includes(q.id);
            return (
              <Text
                key={q.id}
                onPress={() =>
                  setHomeQuickActions(on ? homeQuickActions.filter((x) => x !== q.id) : homeQuickActions.length < 4 ? [...homeQuickActions, q.id] : homeQuickActions)
                }
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  marginRight: 6,
                  marginBottom: 6,
                  overflow: 'hidden',
                  backgroundColor: on ? colors.blue : colors.tertiaryFill,
                  color: on ? '#fff' : colors.label,
                  fontWeight: '600',
                }}
              >
                {q.label}
              </Text>
            );
          })}
        </View>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          Tap to choose up to four, in the order you tap them.
        </Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Cards</Text>
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
