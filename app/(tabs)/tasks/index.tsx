import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { IconCircle } from '../../../src/ui/IconCircle';
import { TaskRow } from '../../../src/features/tasks/TaskRow';
import { AddTaskSheet } from '../../../src/features/tasks/AddTaskSheet';
import { TaskDetailSheet } from '../../../src/features/tasks/TaskDetailSheet';
import { FocusTimer } from '../../../src/features/tasks/FocusTimer';
import { PlanDaySheet } from '../../../src/features/tasks/PlanDaySheet';
import { Icon } from '../../../src/ui/Icon';
import { TextField } from '../../../src/ui/TextField';
import { parseQuickTask } from '../../../src/utils/quickAdd';
import { formatDateKey } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import { formatRelativeDay, formatTime } from '../../../src/utils/date';
import type { Task } from '../../../src/db/types';
import { insertRow } from '../../../src/db/helpers';
import { useUndoStore } from '../../../src/store/undoStore';

const SEGMENTS = ['Today', 'Backlog', 'All', 'Done'];

export default function TasksScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const { tasks, meetings, projects, moveTask, clearCompleted, refreshTasks, addTask } = useProductivityStore();
  const [quickText, setQuickText] = useState('');
  const quick = useMemo(() => parseQuickTask(quickText, projects), [quickText, projects]);

  const submitQuick = async () => {
    if (!quick.title) return;
    await addTask({
      project_id: quick.projectId,
      title: quick.title,
      notes: null,
      status: quick.backlog ? 'backlog' : 'todo',
      priority: quick.priority,
      due_date: null,
      scheduled_date: quick.scheduledDate,
      sort_order: Date.now(),
    });
    setQuickText('');
  };

  const quickWhen = quick.backlog
    ? 'Backlog'
    : quick.scheduledDate === todayKey()
      ? 'Today'
      : quick.scheduledDate
        ? formatDateKey(quick.scheduledDate)
        : 'Unscheduled';
  const [segment, setSegment] = useState(0);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Opened via the Today widget's "+" button (anchor://tasks?action=add).
  useEffect(() => {
    if (action === 'add') setAddVisible(true);
  }, [action]);

  const todayStr = todayKey();
  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => new Date(m.start_at) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 3),
    [meetings]
  );

  const bySegment = useMemo(() => {
    if (segment === 0) {
      return tasks.filter(
        (t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress')
      );
    }
    if (segment === 1) return tasks.filter((t) => t.status === 'backlog');
    if (segment === 3) {
      return tasks
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    }
    return tasks.filter((t) => t.status !== 'backlog' && t.status !== 'done');
  }, [tasks, segment, todayStr]);

  // A deleted project falls back to showing everything.
  const activeProject = projectFilter === 'all' || projectFilter === 'none' || projects.some((p) => p.id === projectFilter) ? projectFilter : 'all';
  const filtered = useMemo(
    () =>
      activeProject === 'all'
        ? bySegment
        : bySegment.filter((t) => (activeProject === 'none' ? !t.project_id : t.project_id === activeProject)),
    [bySegment, activeProject]
  );

  const handleClearCompleted = async () => {
    const removed = await clearCompleted();
    useUndoStore.getState().show(`${removed.length} completed task${removed.length === 1 ? '' : 's'} cleared`, async () => {
      for (const t of removed) await insertRow('tasks', t as unknown as Record<string, unknown>);
      await refreshTasks();
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader
          title="Tasks"
          subtitle="Your personal secretary"
          trailing={
            <View style={{ flexDirection: 'row' }}>
              <Pressable onPress={() => router.push('/tasks/board')} hitSlop={8} style={{ marginRight: spacing.md }}>
                <Icon name="square.grid.2x2" size={22} color={colors.blue} />
              </Pressable>
              <Pressable onPress={() => router.push('/tasks/routines')} hitSlop={8} style={{ marginRight: spacing.md }}>
                <Icon name="list.star" size={22} color={colors.blue} />
              </Pressable>
              <Pressable onPress={() => router.push('/tasks/focus')} hitSlop={8} style={{ marginRight: spacing.md }}>
                <Icon name="timer" size={22} color={colors.blue} />
              </Pressable>
              <Pressable onPress={() => router.push('/tasks/agenda')} hitSlop={8} style={{ marginRight: spacing.md }}>
                <Icon name="calendar" size={22} color={colors.blue} />
              </Pressable>
              <Pressable onPress={() => router.push('/tasks/projects')} hitSlop={8}>
                <Icon name="folder.fill" size={22} color={colors.blue} />
              </Pressable>
            </View>
          }
        />

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
          <TextField
            placeholder="Quick add — e.g. Call mom tomorrow !high #family"
            value={quickText}
            onChangeText={setQuickText}
            onSubmitEditing={submitQuick}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          {quick.title ? (
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.xs, marginBottom: spacing.sm }]}>
              “{quick.title}” · {quickWhen}
              {quick.priority !== 'medium' ? ` · ${quick.priority}` : ''}
              {quick.projectName ? ` · ${quick.projectName}` : ''} — press return to add
            </Text>
          ) : null}
          <SegmentedControl options={SEGMENTS} selectedIndex={segment} onChange={setSegment} />
          {projects.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              <ChipSelector
                options={[
                  { id: 'all', label: 'All projects' },
                  ...projects.map((p) => ({ id: p.id, label: p.name, color: p.color })),
                  { id: 'none', label: 'No project' },
                ]}
                selectedId={activeProject}
                onSelect={setProjectFilter}
              />
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {segment === 0 ? (
            <Pressable
              onPress={() => setPlanVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginBottom: spacing.sm }}
            >
              <Icon name="sun.max.fill" size={16} color={colors.orange} />
              <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Plan my day</Text>
            </Pressable>
          ) : null}
          {segment === 3 && filtered.length > 0 ? (
            <Pressable onPress={handleClearCompleted} style={{ alignSelf: 'flex-end', marginBottom: spacing.sm }}>
              <Text style={[typography.subhead, { color: colors.red }]}>Clear completed</Text>
            </Pressable>
          ) : null}
          {filtered.length === 0 ? (
            <Card>
              <EmptyState icon="checkmark.circle.fill" title="Nothing here" message="Tap + to add a task." />
            </Card>
          ) : (
            <Card padded={false}>
              {filtered.map((task, i, arr) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isLast={i === arr.length - 1}
                  onPress={() => setDetailTask(task)}
                  reorder={
                    segment === 2 && activeProject === 'all'
                      ? {
                          canMoveUp: i > 0,
                          canMoveDown: i < arr.length - 1,
                          onMoveUp: () => moveTask(task.id, 'up'),
                          onMoveDown: () => moveTask(task.id, 'down'),
                        }
                      : undefined
                  }
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddTaskSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <PlanDaySheet visible={planVisible} onClose={() => setPlanVisible(false)} />
      <TaskDetailSheet
        task={detailTask}
        visible={!!detailTask}
        onClose={() => setDetailTask(null)}
        onStartFocus={(task) => {
          setDetailTask(null);
          setFocusTask(task);
        }}
      />
      <FocusTimer task={focusTask} visible={!!focusTask} onClose={() => setFocusTask(null)} />
    </View>
  );
}
