import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ActivityRings } from '../../ui/ActivityRings';
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
  const router = useRouter();
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
    { label: 'Prayers', value: `${prayers}/5`, progress: prayers / 5, color: colors.pink },
    { label: 'Tasks', value: taskTotal ? `${doneToday}/${taskTotal}` : '—', progress: taskTotal ? doneToday / taskTotal : 0, color: colors.green },
    { label: 'Water', value: `${water}/${waterGoal}`, progress: Math.min(1, water / waterGoal), color: colors.cyan },
  ];

  return (
    <Card onPress={() => router.push('/recap')} style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
      <ActivityRings rings={rings} size={118} stroke={14} />
      <View style={{ flex: 1, marginLeft: spacing.lg }}>
        {rings.map((r) => (
          <View key={r.label} style={{ marginBottom: 6 }}>
            <Text style={[typography.footnote, { color: colors.label, fontWeight: '600' }]}>{r.label}</Text>
            <Text style={[typography.title3, { color: r.color, fontVariant: ['tabular-nums'] }]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
