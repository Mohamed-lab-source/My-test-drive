import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
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

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - WEEKS * 7);
    repo.listPrayerLogsSince(todayKey(since)).then((logs) => {
      const counts: Record<string, number> = {};
      for (const log of logs) if (log.completed) counts[log.date] = (counts[log.date] ?? 0) + 1;
      setValues(Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / PRAYERS.length])));
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
    </Card>
  );
}
