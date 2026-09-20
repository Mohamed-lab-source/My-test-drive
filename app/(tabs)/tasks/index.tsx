import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { IconCircle } from '../../../src/ui/IconCircle';
import { TaskRow } from '../../../src/features/tasks/TaskRow';
import { AddTaskSheet } from '../../../src/features/tasks/AddTaskSheet';
import { todayKey } from '../../../src/db/client';
import { formatRelativeDay, formatTime } from '../../../src/utils/date';

const SEGMENTS = ['Today', 'Backlog', 'All'];

export default function TasksScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const { tasks, meetings } = useProductivityStore();
  const [segment, setSegment] = useState(0);
  const [addVisible, setAddVisible] = useState(false);

  // Opened via the Today widget's "+" button (anchor://tasks?action=add).
  useEffect(() => {
    if (action === 'add') setAddVisible(true);
  }, [action]);

  const todayStr = todayKey();
  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => new Date(m.start_at) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 3),
    [meetings]
  );

  const filtered = useMemo(() => {
    if (segment === 0) {
      return tasks.filter(
        (t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress')
      );
    }
    if (segment === 1) return tasks.filter((t) => t.status === 'backlog');
    return tasks.filter((t) => t.status !== 'backlog');
  }, [tasks, segment, todayStr]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader title="Tasks" subtitle="Your personal secretary" />

        {upcomingMeetings.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={[typography.title3, { color: colors.label }]}>Meetings</Text>
              <Pressable onPress={() => router.push('/tasks/meetings')}>
                <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upcomingMeetings.map((m) => (
                <Card key={m.id} style={{ marginRight: spacing.sm, minWidth: 160 }}>
                  <IconCircle name="calendar" color={colors.indigo} size={32} />
                  <Text style={[typography.subhead, { color: colors.label, marginTop: 8, fontWeight: '600' }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                    {formatRelativeDay(m.start_at)} · {formatTime(m.start_at)}
                  </Text>
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <SegmentedControl options={SEGMENTS} selectedIndex={segment} onChange={setSegment} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {filtered.length === 0 ? (
            <Card>
              <EmptyState icon="checkmark.circle.fill" title="Nothing here" message="Tap + to add a task." />
            </Card>
          ) : (
            <Card padded={false}>
              {filtered.map((task, i, arr) => (
                <TaskRow key={task.id} task={task} isLast={i === arr.length - 1} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddTaskSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
