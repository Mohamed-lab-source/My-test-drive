import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressRing } from '../../ui/ProgressRing';
import { useLifeStore } from '../../store/lifeStore';
import { useProductivityStore } from '../../store/productivityStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaterStore } from '../../store/waterStore';
import { todayKey } from '../../db/client';
import { localDateKey } from '../../utils/date';

// Three rings for the day: prayers, tasks and water.
export function TodayRingsCard() {
  const { colors, typography, spacing } = useTheme();
  const prayerLogs = useLifeStore((s) => s.todayPrayerLogs);
  const tasks = useProductivityStore((s) => s.tasks);
  const waterGoal = useSettingsStore((s) => s.waterGoal);
  const water = useWaterStore((s) => s.count);
  const loadWater = useWaterStore((s) => s.load);

  // Water is also logged on the Health screen, so re-read it whenever Home is shown.
  useFocusEffect(
    useCallback(() => {
      loadWater();
    }, [loadWater])
  );

  const today = todayKey();
  const prayers = prayerLogs.filter((l) => l.completed).length;
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === today).length;
  const openToday = tasks.filter((t) => t.status !== 'done' && (t.scheduled_date === today || t.status === 'in_progress')).length;
  const taskTotal = doneToday + openToday;

  const rings = [
    { label: 'Prayers', value: `${prayers}/5`, progress: prayers / 5, color: colors.green },
    { label: 'Tasks', value: taskTotal ? `${doneToday}/${taskTotal}` : '—', progress: taskTotal ? doneToday / taskTotal : 0, color: colors.blue },
    { label: 'Water', value: `${water}/${waterGoal}`, progress: Math.min(1, water / waterGoal), color: colors.cyan },
  ];

  return (
    <Card style={{ marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-around' }}>
      {rings.map((r) => (
        <View key={r.label} style={{ alignItems: 'center' }}>
          <ProgressRing progress={r.progress} color={r.color} size={64} strokeWidth={7} label={r.value} />
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>{r.label}</Text>
        </View>
      ))}
    </Card>
  );
}
