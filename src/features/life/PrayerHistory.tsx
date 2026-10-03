import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Heatmap } from '../../ui/Heatmap';
import { useLifeStore } from '../../store/lifeStore';
import * as repo from '../../db/repositories/life';
import { todayKey } from '../../db/client';
import { PRAYERS } from '../../db/types';

const WEEKS = 5;

export function PrayerHistory() {
  const { colors, typography, spacing } = useTheme();
  const todayPrayerLogs = useLifeStore((s) => s.todayPrayerLogs);
  const [values, setValues] = useState<Record<string, number>>({});
  const [perPrayer, setPerPrayer] = useState<{ prayer: string; rate: number }[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - WEEKS * 7);
    repo.listPrayerLogsSince(todayKey(since)).then((logs) => {
      const counts: Record<string, number> = {};
      for (const log of logs) if (log.completed) counts[log.date] = (counts[log.date] ?? 0) + 1;
      setValues(Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / PRAYERS.length])));
      // Per-prayer rate over the days since tracking started (max 30), so a
      // new user isn't scored on days before they installed the app.
      const recent = logs.filter((l) => l.date >= todayKey(new Date(Date.now() - 29 * 86400000)));
      if (recent.length === 0) return setPerPrayer([]);
      const first = recent.reduce((min, l) => (l.date < min ? l.date : min), recent[0].date);
      const [y, m, d] = first.split('-').map(Number);
      const span = Math.max(1, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d).getTime()) / 86400000) + 1);
      setPerPrayer(
        PRAYERS.map((p) => ({ prayer: p, rate: recent.filter((l) => l.prayer === p && l.completed).length / span }))
      );
    });
  }, [todayPrayerLogs]);

  const fullDays = Object.values(values).filter((v) => v >= 1).length;

  return (
    <Card>
      <Text style={[typography.headline, { color: colors.label }]}>Prayer history</Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
        {fullDays} of {WEEKS * 7} days with all 5 prayers
      </Text>
      <Heatmap values={values} color={colors.green} weeks={WEEKS} />
      {perPrayer.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row' }}>
            {perPrayer.map((p) => (
              <View key={p.prayer} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[typography.subhead, { color: p.rate >= 0.9 ? colors.green : p.rate >= 0.6 ? colors.orange : colors.red, fontWeight: '700' }]}>
                  {Math.round(Math.min(1, p.rate) * 100)}%
                </Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel, textTransform: 'capitalize' }]}>{p.prayer}</Text>
              </View>
            ))}
          </View>
          {(() => {
            const worst = [...perPrayer].sort((a, b) => a.rate - b.rate)[0];
            return worst.rate < 0.9 ? (
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm, textAlign: 'center' }]}>
                <Text style={{ textTransform: 'capitalize', fontWeight: '600' }}>{worst.prayer}</Text> is the one you miss most — a reminder may help.
              </Text>
            ) : null;
          })()}
        </View>
      ) : null}
    </Card>
  );
}
