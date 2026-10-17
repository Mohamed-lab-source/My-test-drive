import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { NAMES, nameOfTheDay } from '../../../src/content/names';

// The 99 Names with today's name on top; tick the ones you've learnt.
export default function NamesScreen() {
  const { colors, typography, spacing } = useTheme();
  const learnt = useSettingsStore((s) => s.checklists.names ?? []);
  const toggle = useSettingsStore((s) => s.toggleChecklistItem);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const today = nameOfTheDay();
  const q = query.trim().toLowerCase();
  const shown = NAMES.filter(
    (n) =>
      (!q || n.name.toLowerCase().includes(q) || n.meaning.toLowerCase().includes(q) || n.arabic.includes(query.trim())) &&
      (filter === 'all' || (filter === 'learnt') === learnt.includes(String(n.n)))
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="99 Names" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md, alignItems: 'center' }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Name of the day · {today.n}</Text>
          <Text style={{ fontSize: 40, color: colors.label, marginTop: 4 }}>{today.arabic}</Text>
          <Text style={[typography.title3, { color: colors.label }]}>{today.name}</Text>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{today.meaning}</Text>
        </Card>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
            {learnt.length} of 99 learnt
          </Text>
          <View style={{ marginTop: 6 }}>
            <ProgressBar progress={learnt.length / 99} color={colors.green} />
          </View>
        </Card>
        <TextField placeholder="Search names or meanings" value={query} onChangeText={setQuery} />
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector
            options={[
              { id: 'all', label: 'All' },
              { id: 'todo', label: 'Not yet learnt' },
              { id: 'learnt', label: 'Learnt' },
            ]}
            selectedId={filter}
            onSelect={setFilter}
          />
        </View>
        <Card padded={false}>
          {shown.map((n, i) => {
            const isLearnt = learnt.includes(String(n.n));
            return (
              <Pressable
                key={n.n}
                onPress={() => {
                  Haptics.selectionAsync();
                  toggle('names', String(n.n));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  borderBottomWidth: i === shown.length - 1 ? 0 : 1,
                  borderBottomColor: colors.separator,
                  backgroundColor: n.n === today.n ? colors.green + '14' : 'transparent',
                }}
              >
                <Text style={[typography.footnote, { color: colors.tertiaryLabel, width: 28 }]}>{n.n}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.label }]}>{n.name}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{n.meaning}</Text>
                </View>
                <Text style={[typography.title3, { color: colors.label, marginRight: spacing.sm }]}>{n.arabic}</Text>
                <Text style={{ fontSize: 18, color: isLearnt ? colors.green : colors.tertiaryLabel }}>{isLearnt ? '✓' : '○'}</Text>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
