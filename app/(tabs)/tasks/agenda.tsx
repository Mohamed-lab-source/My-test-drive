import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatTime } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';

const DAYS_AHEAD = 14;

export default function AgendaScreen() {
  const { colors, typography, spacing } = useTheme();
  const { tasks, meetings } = useProductivityStore();

  const days = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = todayKey(d);
      const label =
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      list.push({ key, label });
    }
    return list;
  }, []);

  const sections = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        tasks: tasks.filter((t) => t.status !== 'done' && t.scheduled_date === day.key),
        meetings: meetings.filter((m) => m.start_at.slice(0, 10) === day.key),
      })),
    [days, tasks, meetings]
  );

  const hasAnything = sections.some((s) => s.tasks.length > 0 || s.meetings.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Agenda" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {!hasAnything ? (
          <EmptyState icon="calendar" title="Nothing scheduled" message="Tasks and meetings for the next two weeks show up here." />
        ) : (
          sections
            .filter((s) => s.tasks.length > 0 || s.meetings.length > 0)
            .map((s) => (
              <View key={s.key} style={{ marginBottom: spacing.lg }}>
                <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>{s.label}</Text>
                <Card padded={false}>
                  {s.meetings.map((m, i) => (
                    <View
                      key={m.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.md,
                        borderBottomWidth: i === s.meetings.length - 1 && s.tasks.length === 0 ? 0 : 0.5,
                        borderBottomColor: colors.separator,
                      }}
                    >
                      <Icon name="calendar" size={18} color={colors.indigo} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={[typography.body, { color: colors.label }]}>{m.title}</Text>
                        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{formatTime(m.start_at)}</Text>
                      </View>
                    </View>
                  ))}
                  {s.tasks.map((t, i) => (
                    <View
                      key={t.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.md,
                        borderBottomWidth: i === s.tasks.length - 1 ? 0 : 0.5,
                        borderBottomColor: colors.separator,
                      }}
                    >
                      <Icon name="circle" size={18} color={colors.gray3} />
                      <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            ))
        )}
      </ScrollView>
    </View>
  );
}
