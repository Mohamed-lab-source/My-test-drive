import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from '../../utils/haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useHabitsStore } from '../../store/habitsStore';
import * as repo from '../../db/repositories/habits';
import { todayKey } from '../../db/client';

// Every habit against the last 7 days; tap a cell to fix a missed log.
export function HabitWeekGrid() {
  const { colors, typography, spacing } = useTheme();
  const { habits, todayLogs, hydrate } = useHabitsStore(useShallow((s) => ({ habits: s.habits, todayLogs: s.todayLogs, hydrate: s.hydrate })));
  const [done, setDone] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });

  useEffect(() => {
    repo.listAllHabitLogsSince(days[0].key).then((logs) => setDone(new Set(logs.map((l) => `${l.habit_id}|${l.date}`))));
  }, [todayLogs, reload, habits.length]);

  if (habits.length === 0) return null;

  const toggle = async (habitId: string, date: string) => {
    Haptics.selectionAsync();
    await repo.setHabitLog(habitId, date, !done.has(`${habitId}|${date}`));
    setReload((r) => r + 1);
    await hydrate();
  };

  const total = habits.length * 7;
  const count = habits.reduce((n, h) => n + days.filter((d) => done.has(`${h.id}|${d.key}`)).length, 0);

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.headline, { color: colors.label }]}>This week</Text>
        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{Math.round((count / total) * 100)}% done</Text>
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        <View style={{ flex: 1 }} />
        {days.map((d, i) => (
          <Text key={d.key} style={[typography.caption2, { width: 30, textAlign: 'center', color: i === 6 ? colors.blue : colors.secondaryLabel }]}>
            {d.label}
          </Text>
        ))}
      </View>
      {habits.map((h) => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
          <Text style={[typography.footnote, { color: colors.label, flex: 1 }]} numberOfLines={1}>
            {h.name}
          </Text>
          {days.map((d) => {
            const on = done.has(`${h.id}|${d.key}`);
            return (
              <Pressable key={d.key} onPress={() => toggle(h.id, d.key)} hitSlop={2} style={{ width: 30, alignItems: 'center' }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: on ? h.color : colors.tertiaryFill }} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
