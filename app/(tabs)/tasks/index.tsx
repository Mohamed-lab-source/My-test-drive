import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import Animated from 'react-native-reanimated';
import { AmbientGlow } from '../../../src/ui/AmbientGlow';
import { CompactHeader, useScrollY } from '../../../src/ui/CollapsingHeader';
import { PressableScale } from '../../../src/ui/PressableScale';
import { SmartLists } from '../../../src/features/tasks/SmartLists';
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
import { WeeklyGoalsCard } from '../../../src/features/tasks/WeeklyGoalsCard';
import { Share } from 'react-native';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Icon } from '../../../src/ui/Icon';
import { TextField } from '../../../src/ui/TextField';
import { parseQuickTask } from '../../../src/utils/quickAdd';
import { formatDateKey } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import { formatClock, formatRelativeDay, formatTime, localDateKey } from '../../../src/utils/date';
import type { Task } from '../../../src/db/types';
import { insertRow } from '../../../src/db/helpers';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { useUndoStore } from '../../../src/store/undoStore';
import { DAILY_CAPACITY_MINUTES, daysToDeadline, formatEstimate, plannedMinutes } from '../../../src/utils/estimate';

function remindAtFor(dateKey: string | null, hhmm: string): string | null {
  const day = dateKey ?? todayKey();
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const at = new Date(y, m - 1, d, h, min);
  return at.getTime() > Date.now() ? at.toISOString() : null;
}

const SEGMENTS = ['Today', 'Backlog', 'All', 'Done', 'Waiting'];

export default function TasksScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const router = useRouter();
  const { action, project } = useLocalSearchParams<{ action?: string; project?: string }>();
  const { tasks, meetings, projects, moveTask, clearCompleted, refreshTasks, addTask, rescheduleTask } = useProductivityStore();
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
      due_date: quick.deadline,
      scheduled_date: quick.scheduledDate,
      repeat_frequency: quick.repeat,
      repeat_interval: quick.repeat ? 1 : null,
      // "at 5pm" on the task's day (today when it isn't scheduled).
      remind_at: quick.remindTime ? remindAtFor(quick.scheduledDate, quick.remindTime) : null,
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
  const [taskSort, setTaskSort] = useState('manual');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const topTaskSetting = useSettingsStore((s) => s.topTask);
  const [addVisible, setAddVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [staleVisible, setStaleVisible] = useState(false);
  const [planTomorrowVisible, setPlanTomorrowVisible] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Opened from a project's "Tasks" link: show All, filtered to it.
  useEffect(() => {
    if (project) {
      setSegment(2);
      setProjectFilter(project);
    }
  }, [project]);

  // Opened via the Today widget's "+" button (anchor://tasks?action=add).
  useEffect(() => {
    if (action === 'add') setAddVisible(true);
  }, [action]);

  const todayStr = todayKey();
  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => new Date(m.start_at) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 3),
    [meetings]
  );

  const todaysMeetingMinutes = meetings
    .filter((m) => new Date(m.start_at).toDateString() === new Date().toDateString())
    .reduce((sum, m) => sum + (m.end_at ? Math.max(0, (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 60000) : 30), 0);
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === todayStr).length;
  const overdue = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.due_date && daysToDeadline(t.due_date) < 0 && t.scheduled_date !== todayStr),
    [tasks, todayStr]
  );
  const bySegment = useMemo(() => {
    if (segment === 0) {
      return tasks.filter(
        // Tasks due today show up here even if they weren't scheduled.
        (t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress' || t.due_date === todayStr)
      );
    }
    if (segment === 4) return tasks.filter((t) => t.status !== 'done' && !!t.waiting_on);
    if (segment === 1) return tasks.filter((t) => t.status === 'backlog');
    if (segment === 3) {
      return tasks
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    }
    return tasks.filter((t) => t.status !== 'backlog' && t.status !== 'done');
  }, [tasks, segment, todayStr]);

  // Counts for the smart-list tiles, using the same rules as bySegment.
  const segmentCounts = useMemo(
    () => [
      tasks.filter((t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress' || t.due_date === todayStr)).length,
      tasks.filter((t) => t.status === 'backlog').length,
      tasks.filter((t) => t.status !== 'backlog' && t.status !== 'done').length,
      tasks.filter((t) => t.status === 'done').length,
      tasks.filter((t) => t.status !== 'done' && !!t.waiting_on).length,
    ],
    [tasks, todayStr]
  );

  // A deleted project falls back to showing everything.
  const activeProject = projectFilter === 'all' || projectFilter === 'none' || projects.some((p) => p.id === projectFilter) ? projectFilter : 'all';
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A search looks across every task, whatever tab is selected.
    const base = q
      ? tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))
      : bySegment;
    const list =
      activeProject === 'all' ? base : base.filter((t) => (activeProject === 'none' ? !t.project_id : t.project_id === activeProject));
    if (taskSort === 'manual' || segment === 3) return list;
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return [...list].sort((a, b) =>
      taskSort === 'priority'
        ? rank[a.priority] - rank[b.priority]
        : taskSort === 'deadline'
          ? (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
          : b.created_at.localeCompare(a.created_at)
    );
  }, [bySegment, activeProject, query, tasks, taskSort, segment]);

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
      <AmbientGlow colors={[colors.blue, colors.indigo]} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader
          scrollY={scrollY}
          title="Tasks"
          subtitle="Your personal secretary"
          trailing={
            <View style={{ flexDirection: 'row' }}>
              {(
                [
                  ['square.grid.2x2', '/tasks/board'],
                  ['list.star', '/tasks/routines'],
                  ['timer', '/tasks/focus'],
                  ['calendar', '/tasks/agenda'],
                  ['folder.fill', '/tasks/projects'],
                ] as const
              ).map(([icon, route]) => (
                <PressableScale
                  key={route}
                  onPress={() => router.push(route)}
                  hitSlop={6}
                  style={{ width: 34, height: 34, borderRadius: 17, marginLeft: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryFill }}
                >
                  <Icon name={icon} size={18} color={colors.blue} />
                </PressableScale>
              ))}
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
              {quick.projectName ? ` · ${quick.projectName}` : ''}
              {quick.remindTime ? ` · ⏰ ${formatClock(quick.remindTime)}` : ''}
              {quick.repeat ? ` · ↻ ${quick.repeat}` : ''}
              {quick.deadline ? ` · 📅 by ${formatDateKey(quick.deadline)}` : ''} — press return to add
            </Text>
          ) : null}
          <SmartLists
            selected={segment}
            onSelect={setSegment}
            lists={[
              { index: 0, label: 'Today', icon: 'calendar', color: colors.blue, count: segmentCounts[0] },
              { index: 2, label: 'All', icon: 'tray.fill', color: '#5B5B61', count: segmentCounts[2] },
              { index: 1, label: 'Backlog', icon: 'archivebox.fill', color: colors.orange, count: segmentCounts[1] },
              { index: 4, label: 'Waiting', icon: 'hourglass', color: colors.purple, count: segmentCounts[4] },
            ]}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Text style={[typography.title3, { color: colors.label }]}>{SEGMENTS[segment]}</Text>
            <Pressable onPress={() => setSegment(segment === 3 ? 0 : 3)} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>{segment === 3 ? 'Hide completed' : `Completed (${segmentCounts[3]})`}</Text>
            </Pressable>
          </View>
          {segment !== 0 && segment !== 3 ? (
            <View style={{ marginTop: spacing.sm }}>
              <ChipSelector
                options={[
                  { id: 'manual', label: 'My order' },
                  { id: 'priority', label: 'Priority' },
                  { id: 'deadline', label: 'Deadline' },
                  { id: 'newest', label: 'Newest' },
                ]}
                selectedId={taskSort}
                onSelect={setTaskSort}
              />
            </View>
          ) : null}
          {projects.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              <ChipSelector
                options={[
                  { id: 'all', label: 'All projects' },
                  ...projects.filter((p) => !p.is_archived).map((p) => ({ id: p.id, label: p.name, color: p.color })),
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
            {segment === 2 || segment === 3 ? (
              <Pressable onPress={() => router.push('/tasks/insights')} style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
                <Icon name="chart.bar.fill" size={16} color={colors.teal} />
                <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>Insights</Text>
              </Pressable>
            ) : null}
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
          {segment === 0 && !query && overdue.length > 0 ? (
            <Card style={{ marginBottom: spacing.sm, backgroundColor: colors.red + '14' }}>
              <Text style={[typography.headline, { color: colors.red }]}>
                {overdue.length} task{overdue.length === 1 ? '' : 's'} past {overdue.length === 1 ? 'its' : 'their'} deadline
              </Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={2}>
                {overdue.map((t) => t.title).join(' · ')}
              </Text>
              <Pressable
                onPress={async () => {
                  for (const t of overdue) await rescheduleTask(t.id, 'today');
                }}
                style={{ marginTop: spacing.xs }}
              >
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Move all to today</Text>
              </Pressable>
            </Card>
          ) : null}
          {segment === 4 && !query ? (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
              Tasks waiting on someone else. Set "Waiting on" in a task to add it here.
            </Text>
          ) : null}
          {segment === 0 && !query && (doneToday > 0 || bySegment.length > 0) ? (
            <View style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                  {doneToday} of {doneToday + bySegment.length} done today
                </Text>
                {bySegment.length === 0 ? <Text style={[typography.subhead, { color: colors.green, fontWeight: '600' }]}>All clear 🎉</Text> : null}
              </View>
              <ProgressBar progress={doneToday / Math.max(1, doneToday + bySegment.length)} color={colors.green} height={6} />
            </View>
          ) : null}
          {segment === 0 && !query ? <WeeklyGoalsCard /> : null}
          {segment === 0 && !query && (plannedMinutes(bySegment) > 0 || todaysMeetingMinutes > 0) ? (
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.headline, { color: colors.label }]}>Today's load</Text>
                <Text
                  style={[
                    typography.headline,
                    { color: plannedMinutes(bySegment) + todaysMeetingMinutes > DAILY_CAPACITY_MINUTES ? colors.red : colors.green },
                  ]}
                >
                  {formatEstimate(plannedMinutes(bySegment) + todaysMeetingMinutes)}
                </Text>
              </View>
              <View style={{ marginTop: 6 }}>
                <ProgressBar
                  progress={(plannedMinutes(bySegment) + todaysMeetingMinutes) / DAILY_CAPACITY_MINUTES}
                  color={plannedMinutes(bySegment) + todaysMeetingMinutes > DAILY_CAPACITY_MINUTES ? colors.red : colors.blue}
                  height={6}
                />
              </View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                {formatEstimate(plannedMinutes(bySegment))} of tasks
                {todaysMeetingMinutes > 0 ? ` + ${formatEstimate(todaysMeetingMinutes)} of meetings` : ''}
                {plannedMinutes(bySegment) + todaysMeetingMinutes > DAILY_CAPACITY_MINUTES
                  ? ' — more than 6h of focused work. Consider moving something to tomorrow.'
                  : ` · ${bySegment.filter((t) => t.status !== 'done' && !t.estimate_minutes).length} without an estimate`}
              </Text>
              {plannedMinutes(bySegment) > 0 ? (
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                  Starting now, you'd finish around {formatTime(new Date(Date.now() + (plannedMinutes(bySegment) + todaysMeetingMinutes) * 60000).toISOString())}
                </Text>
              ) : null}
            </Card>
          ) : null}
          {segment === 0 && !query && new Date().getHours() >= 17 && bySegment.some((t) => t.status === 'todo') ? (
            <Card style={{ marginBottom: spacing.sm }}>
              <Text style={[typography.headline, { color: colors.label }]}>Wrapping up?</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                {bySegment.filter((t) => t.status === 'todo').length} unfinished for today. Move them to tomorrow instead of the backlog?
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <Pressable
                  onPress={async () => {
                    for (const t of bySegment.filter((x) => x.status === 'todo')) await rescheduleTask(t.id, 'tomorrow');
                  }}
                  style={{ marginRight: spacing.lg }}
                >
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Move to tomorrow</Text>
                </Pressable>
                <Pressable onPress={() => setPlanTomorrowVisible(true)}>
                  <Text style={[typography.subhead, { color: colors.blue }]}>Plan tomorrow</Text>
                </Pressable>
              </View>
            </Card>
          ) : null}
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
                    segment === 2 && activeProject === 'all' && taskSort === 'manual'
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
          {filtered.length > 0 && segment !== 3 ? (
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.sm }]}>
              Swipe right to finish · swipe left to move or delete · hold for more
            </Text>
          ) : null}
        </View>
      </Animated.ScrollView>
      <CompactHeader title="Tasks" scrollY={scrollY} />
      <FAB onPress={() => setAddVisible(true)} />
      <AddTaskSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <PlanDaySheet visible={planVisible} onClose={() => setPlanVisible(false)} />
      <StaleBacklogSheet visible={staleVisible} onClose={() => setStaleVisible(false)} />
      <PlanDaySheet visible={planTomorrowVisible} onClose={() => setPlanTomorrowVisible(false)} target="tomorrow" />
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
