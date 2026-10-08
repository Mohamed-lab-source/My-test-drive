import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { HIFZ_SURAHS } from '../../../src/content/surahs';
import { listHifz, setHifzStatus } from '../../../src/db/repositories/hifz';
import type { HifzEntry } from '../../../src/db/types';

type Status = HifzEntry['status'] | null;
const NEXT: Record<string, Status> = { none: 'learning', learning: 'memorised', memorised: null };

export default function HifzScreen() {
  const { colors, typography, spacing } = useTheme();
  const [status, setStatus] = useState<Record<number, HifzEntry['status']>>({});
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => {
    listHifz().then((rows) => setStatus(Object.fromEntries(rows.map((r) => [r.surah, r.status]))));
  }, []);
  useEffect(load, [load]);

  const cycle = async (surah: number) => {
    const next = NEXT[status[surah] ?? 'none'];
    Haptics.selectionAsync();
    await setHifzStatus(surah, next);
    load();
  };

  const totalAyahs = HIFZ_SURAHS.reduce((s, x) => s + x.ayahs, 0);
  const memorised = HIFZ_SURAHS.filter((s) => status[s.number] === 'memorised');
  const learning = HIFZ_SURAHS.filter((s) => status[s.number] === 'learning');
  const memorisedAyahs = memorised.reduce((s, x) => s + x.ayahs, 0);
  // Juz 'Amma is usually learnt from the end (An-Nas) backwards.
  const suggestion = [...HIFZ_SURAHS].reverse().find((s) => !status[s.number]);
  const shown = HIFZ_SURAHS.filter((s) =>
    filter === 'all' ? true : filter === 'todo' ? !status[s.number] : status[s.number] === filter
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Hifz tracker" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Al-Fatiha + Juz &apos;Amma</Text>
          <Text style={[typography.title1, { color: colors.label }]}>
            {memorised.length} / {HIFZ_SURAHS.length} surahs
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <ProgressBar progress={memorisedAyahs / totalAyahs} color={colors.green} />
          </View>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
            {memorisedAyahs} of {totalAyahs} ayahs memorised{learning.length ? ` · ${learning.length} in progress` : ''}
          </Text>
          {suggestion ? (
            <Text style={[typography.subhead, { color: colors.label, marginTop: spacing.sm }]}>
              Next up: <Text style={{ fontWeight: '700' }}>{suggestion.name}</Text> ({suggestion.ayahs} ayahs)
            </Text>
          ) : (
            <Text style={[typography.subhead, { color: colors.green, marginTop: spacing.sm, fontWeight: '600' }]}>
              Ma sha Allah — all memorised! Keep revising.
            </Text>
          )}
        </Card>

        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector
            options={[
              { id: 'all', label: 'All' },
              { id: 'todo', label: 'Not started' },
              { id: 'learning', label: 'Learning' },
              { id: 'memorised', label: 'Memorised' },
            ]}
            selectedId={filter}
            onSelect={setFilter}
          />
        </View>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
          Tap a surah to move it: not started → learning → memorised.
        </Text>

        <Card padded={false}>
          {shown.map((s, i) => {
            const st = status[s.number];
            const color = st === 'memorised' ? colors.green : st === 'learning' ? colors.orange : colors.tertiaryLabel;
            return (
              <Pressable
                key={s.number}
                onPress={() => cycle(s.number)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  borderBottomWidth: i === shown.length - 1 ? 0 : 1,
                  borderBottomColor: colors.separator,
                }}
              >
                <Text style={[typography.footnote, { color: colors.secondaryLabel, width: 32 }]}>{s.number}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.label }]}>{s.name}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{s.ayahs} ayahs</Text>
                </View>
                <Text style={[typography.title3, { color: colors.label, marginRight: spacing.md }]}>{s.arabic}</Text>
                <View style={{ width: 86, alignItems: 'flex-end' }}>
                  <Text style={[typography.caption1, { color, fontWeight: '700' }]}>
                    {st === 'memorised' ? '✓ Memorised' : st === 'learning' ? '◐ Learning' : '○ Not yet'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
