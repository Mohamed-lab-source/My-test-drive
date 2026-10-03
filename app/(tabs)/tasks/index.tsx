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
import { StaleBacklogSheet, staleBacklog } from '../../../src/features/tasks/StaleBacklogSheet';
import { Share } from 'react-native';
import { useSettingsStore } from '../../../src/store/settingsStore';
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
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const topTaskSetting = useSettingsStore((s) => s.topTask);
  const [addVisible, setAddVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [staleVisible, setStaleVisible] = useState(false);
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
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A search looks across every task, whatever tab is selected.
    const base = q
      ? tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))
      : bySegment;
    return activeProject === 'all'
      ? base
      : base.filter((t) => (activeProject === 'none' ? !t.project_id : t.project_id === activeProject));
  }, [bySegment, activeProject, query, tasks]);

  const staleCount = useMemo(() => staleBacklog(tasks).length, [tasks]);

  const shareToday = () => {
    const lines = bySegment.map((t) => `☐ ${t.title}`);
    const meetingsToday = meetings.filter((m) => new Date(m.start_at).toDateString() === new Date().toDateString());
    const msg = [
      `Today — ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      ...meetingsToday.map((m) => `📅 ${formatTime(m.start_at)} ${m.title}`),
      ...lines,
    ].join('\n');
    Share.share({ message: msg });
  };

  const topTask =
    topTaskSetting && topTaskSetting.date === todayKey()
      ? tasks.find((t) => t.id === topTaskSetting.id && t.status !== 'done') ?? null
      : null;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Pressable
              onPress={() => {
                setSearching((v) => !v);
                setQuery('');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            >
              <Icon name="magnifyingglass" size={16} color={colors.blue} />
              <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>{searching ? 'Close search' : 'Search'}</Text>
            </Pressable>
            {segment === 2 ? (
              <Pressable onPress={() => router.push('/tasks/matrix')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="flag.fill" size={16} color={colors.red} />
                <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Priority matrix</Text>
              </Pressable>
            ) : null}
            {segment === 0 && filtered.length > 0 ? (
              <Pressable onPress={shareToday} style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
                <Icon name="square.and.arrow.up" size={16} color={colors.blue} />
                <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Share</Text>
              </Pressable>
            ) : null}
            {segment === 0 ? (
              <Pressable onPress={() => setPlanVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="sun.max.fill" size={16} color={colors.orange} />
                <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Plan my day</Text>
              </Pressable>
            ) : null}
          </View>
          {segment === 1 && staleCount > 0 ? (
            <Pressable onPress={() => setStaleVisible(true)}>
              <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="archivebox.fill" size={18} color={colors.orange} />
                <Text style={[typography.subhead, { color: colors.label, flex: 1, marginLeft: spacing.sm }]}>
                  {staleCount} task{staleCount === 1 ? ' has' : 's have'} waited 30+ days — tidy up?
                </Text>
                <Icon name="chevron.right" size={14} color={colors.tertiaryLabel} />
              </Card>
            </Pressable>
          ) : null}
          {searching ? <TextField placeholder="Search all tasks" value={query} onChangeText={setQuery} autoFocus /> : null}
          {segment === 0 && topTask && !query ? (
            <Pressable onPress={() => setDetailTask(topTask)}>
              <Card style={{ marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.green + '66' }}>
                <Text style={[typography.caption1, { color: colors.green, fontWeight: '700' }]}>🐸 TODAY'S TOP TASK</Text>
                <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>{topTask.title}</Text>
              </Card>
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
      <StaleBacklogSheet visible={staleVisible} onClose={() => setStaleVisible(false)} />
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
