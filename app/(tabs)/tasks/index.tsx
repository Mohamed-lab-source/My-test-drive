import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AmbientGlow } from '../../../src/ui/AmbientGlow';
import { CompactHeader, useScrollY } from '../../../src/ui/CollapsingHeader';
import { PressableScale } from '../../../src/ui/PressableScale';
import * as Haptics from '../../../src/utils/haptics';
import { meetingCountdown, meetingLink } from '../../../src/utils/meetingInfo';
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
import { Share, Linking, RefreshControl } from 'react-native';
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
import { ActionMenu } from '../../../src/ui/ActionMenu';

function remindAtFor(dateKey: string | null, hhmm: string): string | null {
  const day = dateKey ?? todayKey();
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const at = new Date(y, m - 1, d, h, min);
  return at.getTime() > Date.now() ? at.toISOString() : null;
}

const EMPTY: Record<number, { title: string; message: string }> = {
  0: { title: 'Nothing planned for today', message: 'Tap + or type above, e.g. "Call the bank at 3pm".' },
  1: { title: 'Backlog is empty', message: 'Add "someday" to a quick add to park a task here.' },
  2: { title: 'No open tasks', message: 'Tap + to add one.' },
  3: { title: 'Nothing completed yet', message: 'Finished tasks show up here.' },
  4: { title: 'Not waiting on anyone', message: 'Type "@name" in a quick add, e.g. "Contract @Ahmed".' },
  5: { title: 'Nothing for tomorrow yet', message: 'Type "tomorrow" in a quick add, or swipe a task left → Tomorrow.' },
  6: { title: 'Nothing scheduled ahead', message: 'Try "next monday", "in 3 days" or "25/12" in a quick add.' },
};

const SEGMENTS = ['Today', 'Backlog', 'All', 'Done', 'Waiting', 'Tomorrow', 'Upcoming'];

export default function TasksScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const router = useRouter();
  const { action, project } = useLocalSearchParams<{ action?: string; project?: string }>();
  const { tasks, meetings, projects, moveTask, clearCompleted, refreshTasks, addTask, rescheduleTask, updateTask } = useProductivityStore(useShallow((s) => ({ tasks: s.tasks, meetings: s.meetings, projects: s.projects, moveTask: s.moveTask, clearCompleted: s.clearCompleted, refreshTasks: s.refreshTasks, addTask: s.addTask, rescheduleTask: s.rescheduleTask, updateTask: s.updateTask })));
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
      estimate_minutes: quick.estimate,
      waiting_on: quick.waitingOn,
      sort_order: Date.now(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useUndoStore.getState().show(`Added: ${quick.title}`);
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
  const [viewsOpen, setViewsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const topTaskSetting = useSettingsStore((s) => s.topTask);
  const [addVisible, setAddVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const tomorrowStr = todayKey(new Date(Date.now() + 86400000));
  // Quick filters on top of the list (all must match).
  const [quickFilters, setQuickFilters] = useState<string[]>([]);
  const [showDoneToday, setShowDoneToday] = useState(false);
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
    if (segment === 5) return tasks.filter((t) => t.status !== 'done' && t.scheduled_date === tomorrowStr);
    // Everything planned after today, soonest first.
    if (segment === 6)
      return tasks
        .filter((t) => t.status !== 'done' && !!t.scheduled_date && t.scheduled_date > todayStr)
        .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!));
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
      tasks.filter((t) => t.status !== 'done' && t.scheduled_date === tomorrowStr).length,
      tasks.filter((t) => t.status !== 'done' && !!t.scheduled_date && t.scheduled_date > todayStr).length,
    ],
    [tasks, todayStr]
  );

  // A deleted project falls back to showing everything.
  const activeProject = projectFilter === 'all' || projectFilter === 'none' || projects.some((p) => p.id === projectFilter) ? projectFilter : 'all';
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A search looks across every task, whatever tab is selected.
    const base = q
      ? tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.notes ?? '').toLowerCase().includes(q) ||
            (t.waiting_on ?? '').toLowerCase().includes(q) ||
            (projects.find((p) => p.id === t.project_id)?.name ?? '').toLowerCase().includes(q)
        )
      : bySegment;
    const byProject =
      activeProject === 'all' ? base : base.filter((t) => (activeProject === 'none' ? !t.project_id : t.project_id === activeProject));
    const list = byProject.filter(
      (t) =>
        (!quickFilters.includes('high') || t.priority === 'high') &&
        (!quickFilters.includes('deadline') || !!t.due_date) &&
        (!quickFilters.includes('quick') || (!!t.estimate_minutes && t.estimate_minutes <= 15)) &&
        (!quickFilters.includes('reminder') || !!t.remind_at)
    );
    if (taskSort === 'manual' || segment === 3) return list;
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return [...list].sort((a, b) =>
      taskSort === 'priority'
        ? rank[a.priority] - rank[b.priority]
        : taskSort === 'deadline'
          ? (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
          : taskSort === 'quick'
            ? (a.estimate_minutes ?? 9999) - (b.estimate_minutes ?? 9999)
            : b.created_at.localeCompare(a.created_at)
    );
  }, [bySegment, activeProject, query, tasks, taskSort, segment, quickFilters, projects]);

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
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            progressViewOffset={insets.top}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([refreshTasks(), useProductivityStore.getState().refreshMeetings(), useProductivityStore.getState().refreshSubtaskCounts()]);
              setRefreshing(false);
            }}
          />
        }
      >
        <ScreenHeader
          scrollY={scrollY}
          title="Tasks"
          subtitle="Your personal secretary"
          trailing={
            <PressableScale
              onPress={() => setViewsOpen(true)}
              hitSlop={6}
              accessibilityLabel="More task views"
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.tertiaryFill }}
            >
              <Icon name="square.grid.2x2" size={16} color={colors.blue} />
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600', marginLeft: 6 }]}>More</Text>
            </PressableScale>
          }
        />

        <ActionMenu
          visible={viewsOpen}
          title="Tasks"
          onClose={() => setViewsOpen(false)}
          actions={[
            { label: 'Agenda', icon: 'calendar', onPress: () => router.push('/tasks/agenda') },
            { label: 'Board', icon: 'square.grid.2x2', onPress: () => router.push('/tasks/board') },
            { label: 'Projects', icon: 'folder.fill', onPress: () => router.push('/tasks/projects') },
            { label: 'Routines', icon: 'list.star', onPress: () => router.push('/tasks/routines') },
            { label: 'Focus timer', icon: 'timer', onPress: () => router.push('/tasks/focus'), section: true },
            { label: 'Meetings', icon: 'person.2.fill', onPress: () => router.push('/tasks/meetings') },
            { label: 'Priority matrix', icon: 'flag.fill', onPress: () => router.push('/tasks/matrix'), section: true },
            { label: 'Insights', icon: 'chart.bar.fill', onPress: () => router.push('/tasks/insights') },
          ]}
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
                  {meetingCountdown(m.start_at, m.end_at) ? (
                    <Text style={[typography.caption1, { color: meetingCountdown(m.start_at, m.end_at) === 'Now' ? colors.green : colors.orange, fontWeight: '700', marginTop: 2 }]}>
                      {meetingCountdown(m.start_at, m.end_at)}
                    </Text>
                  ) : null}
                  {meetingLink(m) ? (
                    <Pressable onPress={() => Linking.openURL(meetingLink(m)!).catch(() => {})} style={{ marginTop: 6 }}>
                      <Text style={[typography.subhead, { color: colors.green, fontWeight: '700' }]}>Join ›</Text>
                    </Pressable>
                  ) : null}
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
              {quick.deadline ? ` · 📅 by ${formatDateKey(quick.deadline)}` : ''}
              {quick.estimate ? ` · ⏱ ${quick.estimate}m` : ''}
              {quick.waitingOn ? ` · ⏳ ${quick.waitingOn}` : ''} — press return to add
            </Text>
          ) : null}
          <SmartLists
            selected={segment}
            onSelect={setSegment}
            columns={3}
            lists={[
              { index: 0, label: 'Today', icon: 'calendar', color: colors.blue, count: segmentCounts[0] },
              { index: 5, label: 'Tomorrow', icon: 'sunrise.fill', color: colors.teal, count: segmentCounts[5] },
              { index: 6, label: 'Upcoming', icon: 'calendar.badge.clock', color: colors.red, count: segmentCounts[6] },
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
                  { id: 'quick', label: 'Quick wins' },
                ]}
                selectedId={taskSort}
                onSelect={setTaskSort}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
            {[
              { id: 'high', label: '🔴 High' },
              { id: 'deadline', label: '📅 Has deadline' },
              { id: 'quick', label: '⚡ Under 15m' },
              { id: 'reminder', label: '🔔 Reminder' },
            ].map((f) => {
              const on = quickFilters.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setQuickFilters((xs) => (on ? xs.filter((x) => x !== f.id) : [...xs, f.id]))}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                    marginRight: 6,
                    marginBottom: 6,
                    backgroundColor: on ? colors.blue : colors.tertiaryFill,
                  }}
                >
                  <Text style={[typography.footnote, { color: on ? '#fff' : colors.label, fontWeight: on ? '600' : '400' }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {projects.length > 0 ? (
            <View style={{ marginTop: spacing.xs }}>
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
              {bySegment.some((t) => t.status !== 'done' && !t.estimate_minutes) ? (
                <Pressable
                  onPress={async () => {
                    for (const t of bySegment.filter((x) => x.status !== 'done' && !x.estimate_minutes)) await updateTask(t.id, { estimate_minutes: 15 });
                  }}
                  style={{ marginTop: 4 }}
                >
                  <Text style={[typography.caption1, { color: colors.blue, fontWeight: '600' }]}>Give the rest 15 min each</Text>
                </Pressable>
              ) : null}
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
          {segment === 1 && !query && bySegment.length > 0 ? (
            <Pressable
              onPress={async () => {
                // High priority first, then the ones waiting longest.
                const rank = { high: 0, medium: 1, low: 2 } as const;
                const pick = [...bySegment].sort((a, b) => rank[a.priority] - rank[b.priority] || a.created_at.localeCompare(b.created_at)).slice(0, 3);
                for (const t of pick) await updateTask(t.id, { status: 'todo', scheduled_date: todayStr });
                useUndoStore.getState().show(`${pick.length} moved to today`, async () => {
                  for (const t of pick) await updateTask(t.id, { status: 'backlog', scheduled_date: null });
                });
              }}
              style={{ marginBottom: spacing.sm }}
            >
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>☀️ Pick {Math.min(3, bySegment.length)} for today</Text>
            </Pressable>
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
            segment === 0 && !query && doneToday > 0 && quickFilters.length === 0 ? (
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.green + '18' }}>
                  <Text style={{ fontSize: 44 }}>🎉</Text>
                  <Text style={[typography.title3, { color: colors.label, marginTop: spacing.xs }]}>All done for today</Text>
                  <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 2, textAlign: 'center' }]}>
                    {doneToday} task{doneToday === 1 ? '' : 's'} finished. Plan tomorrow or enjoy the rest of your day.
                  </Text>
                  <Pressable onPress={() => setSegment(5)} style={{ marginTop: spacing.sm }}>
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>See tomorrow ›</Text>
                  </Pressable>
                </Card>
              </Animated.View>
            ) : (
              <Card>
                <EmptyState
                  icon="checkmark.circle.fill"
                  title={query ? 'No matching tasks' : quickFilters.length ? 'Nothing matches these filters' : EMPTY[segment]?.title ?? 'Nothing here'}
                  message={query || quickFilters.length ? 'Try a different search or filter.' : EMPTY[segment]?.message ?? 'Tap + to add a task.'}
                />
              </Card>
            )
          ) : (
            <Card padded={false}>
              {filtered.map((task, i, arr) => (
                <React.Fragment key={task.id}>
                {/* Upcoming: a date heading where the day changes. */}
                {segment === 6 && !query && task.scheduled_date !== arr[i - 1]?.scheduled_date ? (
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.quaternaryFill }}>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '700', textTransform: 'uppercase' }]}>
                      {task.scheduled_date === tomorrowStr ? 'Tomorrow' : formatDateKey(task.scheduled_date!)}
                    </Text>
                  </View>
                ) : null}
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
                </React.Fragment>
              ))}
            </Card>
          )}
          {segment === 0 && !query && doneToday > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Pressable onPress={() => setShowDoneToday((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <Text style={[typography.subhead, { color: colors.secondaryLabel, fontWeight: '600', flex: 1 }]}>Done today ({doneToday})</Text>
                <Icon name={showDoneToday ? 'chevron.down' : 'chevron.right'} size={14} color={colors.secondaryLabel} />
              </Pressable>
              {showDoneToday ? (
                <Card padded={false}>
                  {tasks
                    .filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === todayStr)
                    .map((task, i, arr) => (
                      <TaskRow key={task.id} task={task} isLast={i === arr.length - 1} onPress={() => setDetailTask(task)} />
                    ))}
                </Card>
              ) : null}
            </View>
          ) : null}
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
