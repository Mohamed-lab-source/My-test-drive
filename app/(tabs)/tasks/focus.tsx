import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { useProductivityStore } from '../../../src/store/productivityStore';
import * as repo from '../../../src/db/repositories/productivity';
import { todayKey } from '../../../src/db/client';
import { localDateKey } from '../../../src/utils/date';
import type { FocusSession } from '../../../src/db/types';

const DAYS = 7;
const CHART_HEIGHT = 100;

const fmt = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export default function FocusStatsScreen() {
  const { colors, typography, spacing } = useTheme();
  const tasks = useProductivityStore((s) => s.tasks);
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    repo.listFocusSessionsSince(since.toISOString()).then(setSessions);
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(localDateKey(s.completed_at), (m.get(localDateKey(s.completed_at)) ?? 0) + s.minutes);
    return m;
  }, [sessions]);

  const now = new Date();
  const week = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i));
    return { key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), minutes: byDay.get(todayKey(d)) ?? 0 };
  });
  const max = Math.max(1, ...week.map((d) => d.minutes));
  const today = byDay.get(todayKey()) ?? 0;
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);

  // Consecutive days with any focus, counting back from today (or from
  // yesterday if nothing's been logged yet today).
  let streak = 0;
  for (let i = today > 0 ? 0 : 1; i < 90; i++) {
    const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    if (!byDay.get(key)) break;
    streak++;
  }

  const topTasks = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) if (s.task_id) m.set(s.task_id, (m.get(s.task_id) ?? 0) + s.minutes);
    return Array.from(m.entries())
      .map(([id, minutes]) => ({ title: tasks.find((t) => t.id === id)?.title ?? 'Deleted task', minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
  }, [sessions, tasks]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Focus" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', marginHorizontal: -4, marginBottom: spacing.md }}>
          {[
            { label: 'Today', value: fmt(today) },
            { label: 'Last 7 days', value: fmt(weekTotal) },
            { label: 'Streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
          ].map((s) => (
            <Card key={s.label} style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
              <Text style={[typography.title3, { color: colors.label }]}>{s.value}</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>This week</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT }}>
            {week.map((d) => (
              <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
                {d.minutes > 0 ? (
                  <Text style={[typography.caption2, { color: colors.secondaryLabel, marginBottom: 2 }]}>{d.minutes}</Text>
                ) : null}
                <View
                  style={{
                    width: 18,
                    borderRadius: 4,
                    backgroundColor: d.key === todayKey() ? colors.orange : colors.blue,
                    height: Math.max(3, (d.minutes / max) * (CHART_HEIGHT - 16)),
                  }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            {week.map((d) => (
              <Text key={d.key} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.secondaryLabel }]}>
                {d.label}
              </Text>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Most focused tasks (90 days)</Text>
          {topTasks.length === 0 ? (
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>
              Start a focus timer from any task to see your stats here.
            </Text>
          ) : (
            topTasks.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={[typography.body, { color: colors.secondaryLabel }]}>{fmt(t.minutes)}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
