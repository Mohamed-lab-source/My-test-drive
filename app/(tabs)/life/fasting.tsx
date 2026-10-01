import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Heatmap } from '../../../src/ui/Heatmap';
import * as repo from '../../../src/db/repositories/life';
import { todayKey } from '../../../src/db/client';
import type { FastingLog, FastKind } from '../../../src/db/types';
import { Icon } from '../../../src/ui/Icon';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { getHijriMonthDays, toHijri } from '../../../src/utils/hijri';

// The current Ramadan, or the most recent one if we're past it.
function latestRamadanAnchor(offset: number): Date | null {
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    if (toHijri(d, offset).month === 9) return new Date(d);
    d.setDate(d.getDate() - 1);
  }
  return null;
}

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

  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const [owed, setOwed] = useState(0);
  const load = useCallback(async () => {
    setLogs(await repo.listFastingLogsSince(dayKey(-400)));
    setOwed(await repo.getFastsOwed());
  }, []);
  const ramadan = useMemo(() => {
    const anchor = latestRamadanAnchor(hijriOffset);
    return anchor ? getHijriMonthDays(anchor, hijriOffset) : [];
  }, [hijriOffset]);
  const ramadanKeys = new Set(logs.filter((l) => l.kind === 'ramadan').map((l) => l.date));
  const todayStr = todayKey();
  const ramadanPast = ramadan.filter((d) => todayKey(d.date) <= todayStr);
  const ramadanMissed = ramadanPast.filter((d) => !ramadanKeys.has(todayKey(d.date))).length;

  const toggleRamadanDay = async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.setFast(key, ramadanKeys.has(key) ? null : 'ramadan');
    await load();
  };

  const changeOwed = async (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.adjustFastsOwed(delta);
    await load();
  };
  useEffect(() => {
    load();
  }, [load]);

  const selectedKey = dayKey(-dayOffset);
  const selectedKind = logs.find((l) => l.date === selectedKey)?.kind ?? 'none';
  const yearAgo = dayKey(-365);
  const counts = logs.filter((l) => l.date >= yearAgo).reduce<Record<FastKind, number>>(
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

        {ramadan.length > 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Ramadan {ramadan[0].hijri.year}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
              {ramadanPast.length - ramadanMissed} fasted
              {ramadanMissed > 0 ? ` · ${ramadanMissed} not logged` : ''} · tap a day to toggle
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {ramadan.map((d) => {
                const key = todayKey(d.date);
                const fasted = ramadanKeys.has(key);
                const future = key > todayStr;
                return (
                  <Pressable
                    key={key}
                    disabled={future}
                    onPress={() => toggleRamadanDay(key)}
                    style={{ width: '14.28%', padding: 3 }}
                  >
                    <View
                      style={{
                        aspectRatio: 1,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: fasted ? colors.purple : future ? colors.quaternaryFill : colors.tertiaryFill,
                      }}
                    >
                      <Text style={[typography.footnote, { color: fasted ? '#fff' : future ? colors.tertiaryLabel : colors.label, fontWeight: '600' }]}>
                        {d.hijri.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Make-up fasts owed</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, flex: 1 }]}>
              {owed === 0 ? 'Nothing owed.' : 'Tap − each time you make one up.'}
              {ramadanMissed > 0 && owed === 0 ? ` ${ramadanMissed} Ramadan day${ramadanMissed === 1 ? '' : 's'} not logged above.` : ''}
            </Text>
            <Pressable onPress={() => changeOwed(-1)} disabled={owed === 0} hitSlop={8}>
              <Icon name="minus.circle" size={28} color={owed === 0 ? colors.gray4 : colors.green} />
            </Pressable>
            <Text style={[typography.title2, { color: colors.label, width: 48, textAlign: 'center' }]}>{owed}</Text>
            <Pressable onPress={() => changeOwed(1)} hitSlop={8}>
              <Icon name="plus.circle.fill" size={28} color={colors.orange} />
            </Pressable>
          </View>
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
