import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { MiniBars, lastDays } from '../../../src/ui/MiniBars';
import * as repo from '../../../src/db/repositories/health';
import { todayKey } from '../../../src/db/client';
import type { SunnahPrayerKind, SunnahPrayerLog } from '../../../src/db/types';

// rakah counts the confirmed rawatib toward the daily 12.
const PRAYERS: { kind: SunnahPrayerKind; label: string; detail: string; rawatib: number }[] = [
  { kind: 'fajr_before', label: 'Before Fajr', detail: '2 rak‘ah', rawatib: 2 },
  { kind: 'duha', label: 'Duha', detail: 'Mid-morning, 2 rak‘ah or more', rawatib: 0 },
  { kind: 'dhuhr_rawatib', label: 'Dhuhr sunnah', detail: '4 before, 2 after', rawatib: 6 },
  { kind: 'maghrib_after', label: 'After Maghrib', detail: '2 rak‘ah', rawatib: 2 },
  { kind: 'isha_after', label: 'After Isha', detail: '2 rak‘ah', rawatib: 2 },
  { kind: 'tahajjud', label: 'Tahajjud / Qiyam', detail: 'Night prayer', rawatib: 0 },
  { kind: 'witr', label: 'Witr', detail: 'An odd number of rak‘ah', rawatib: 0 },
];

export default function SunnahPrayersScreen() {
  const { colors, typography, spacing } = useTheme();
  const today = todayKey();
  const week = lastDays(7, todayKey);
  const [logs, setLogs] = useState<SunnahPrayerLog[]>([]);

  const load = useCallback(() => repo.listSunnahPrayersSince(week[0].key).then(setLogs), [week[0].key]);
  useEffect(() => {
    load();
  }, [load]);

  const doneToday = new Set(logs.filter((l) => l.date === today).map((l) => l.kind));
  const rawatib = PRAYERS.filter((p) => doneToday.has(p.kind)).reduce((s, p) => s + p.rawatib, 0);

  const toggle = async (kind: SunnahPrayerKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.setSunnahPrayer(today, kind, !doneToday.has(kind));
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Sunnah prayers" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>{rawatib} of 12 rawatib rak‘ah today</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
            Whoever prays twelve rak‘ah a day, a house is built for him in Paradise (Muslim).
          </Text>
        </Card>
        <Card padded={false} style={{ marginBottom: spacing.md }}>
          {PRAYERS.map((p, i) => {
            const done = doneToday.has(p.kind);
            return (
              <Pressable
                key={p.kind}
                onPress={() => toggle(p.kind)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  borderBottomWidth: i === PRAYERS.length - 1 ? 0 : 0.5,
                  borderBottomColor: colors.separator,
                }}
              >
                <Icon name={done ? 'checkmark.circle.fill' : 'circle'} size={26} color={done ? colors.green : colors.gray3} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.body, { color: colors.label }]}>{p.label}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{p.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Last 7 days</Text>
          <MiniBars data={week.map((d) => ({ ...d, value: logs.filter((l) => l.date === d.key).length }))} color={colors.green} max={PRAYERS.length} />
        </Card>
      </ScrollView>
    </View>
  );
}
