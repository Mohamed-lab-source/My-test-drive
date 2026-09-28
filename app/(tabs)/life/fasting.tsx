import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Heatmap } from '../../../src/ui/Heatmap';
import * as repo from '../../../src/db/repositories/life';
import { todayKey } from '../../../src/db/client';
import type { FastingLog, FastKind } from '../../../src/db/types';

const KINDS: { id: FastKind | 'none'; label: string }[] = [
  { id: 'none', label: 'Not fasting' },
  { id: 'ramadan', label: 'Ramadan' },
  { id: 'voluntary', label: 'Voluntary' },
  { id: 'makeup', label: 'Make-up' },
];
const KIND_LABEL: Record<FastKind, string> = { ramadan: 'Ramadan', voluntary: 'Voluntary', makeup: 'Make-up' };

function dayKey(offset: number): string {
  const d = new Date();
  return todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
}

export default function FastingScreen() {
  const { colors, typography, spacing } = useTheme();
  const [logs, setLogs] = useState<FastingLog[]>([]);
  const [dayOffset, setDayOffset] = useState(0);

  const load = useCallback(() => repo.listFastingLogsSince(dayKey(-365)).then(setLogs), []);
  useEffect(() => {
    load();
  }, [load]);

  const selectedKey = dayKey(-dayOffset);
  const selectedKind = logs.find((l) => l.date === selectedKey)?.kind ?? 'none';
  const counts = logs.reduce<Record<FastKind, number>>(
    (acc, l) => ({ ...acc, [l.kind]: acc[l.kind] + 1 }),
    { ramadan: 0, voluntary: 0, makeup: 0 }
  );

  const setKind = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.setFast(selectedKey, id === 'none' ? null : (id as FastKind));
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Fasting" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ marginBottom: spacing.sm }}>
            <ChipSelector
              options={[
                { id: '0', label: 'Today' },
                { id: '1', label: 'Yesterday' },
              ]}
              selectedId={String(dayOffset)}
              onSelect={(id) => setDayOffset(Number(id))}
            />
          </View>
          <ChipSelector options={KINDS} selectedId={selectedKind} onSelect={setKind} />
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Recent fasts</Text>
          <Heatmap values={Object.fromEntries(logs.map((l) => [l.date, 1]))} color={colors.purple} />
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Last 12 months</Text>
          {(Object.keys(KIND_LABEL) as FastKind[]).map((k) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={[typography.body, { color: colors.secondaryLabel }]}>{KIND_LABEL[k]}</Text>
              <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>
                {counts[k]} day{counts[k] === 1 ? '' : 's'}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
