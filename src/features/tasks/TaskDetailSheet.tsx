import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import * as Haptics from '../../utils/haptics';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChipSelector } from '../../ui/ChipSelector';
import { DEADLINE_OPTIONS, ESTIMATE_OPTIONS, deadlineFromOption, deadlineLabel } from '../../utils/estimate';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/productivity';
import { todayKey } from '../../db/client';
import { formatDateKey, formatRelativeDay, formatTime } from '../../utils/date';
import type { RecurringFrequency, Subtask, Task, TaskPriority } from '../../db/types';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const SCHEDULE_OPTIONS: { id: repo.RescheduleTarget; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'next_week', label: 'Next week' },
  { id: 'backlog', label: 'Backlog' },
];

function scheduleLabel(task: Task): string {
  if (task.status === 'backlog') return 'In backlog';
  if (!task.scheduled_date) return 'Not scheduled';
  if (task.scheduled_date === todayKey()) return 'Today';
  return formatDateKey(task.scheduled_date);
}

const REMIND_OPTIONS = [
  { id: 'min20', label: 'In 20 min' },
  { id: 'hour', label: 'In 1 hour' },
  { id: 'hours3', label: 'In 3 hours' },
  { id: 'evening', label: 'This evening' },
  { id: 'tomorrow', label: 'Tomorrow 9 AM' },
  { id: 'clear', label: 'No reminder' },
];

function reminderTime(option: string, now: Date = new Date()): string | null {
  if (option === 'min20') return new Date(now.getTime() + 20 * 60000).toISOString();
  if (option === 'hour') return new Date(now.getTime() + 3600000).toISOString();
  if (option === 'hours3') return new Date(now.getTime() + 3 * 3600000).toISOString();
  if (option === 'evening') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (option === 'tomorrow') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0).toISOString();
  return null;
}

const REPEAT_OPTIONS: { id: RecurringFrequency | 'none'; label: string }[] = [
  { id: 'none', label: 'Never' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

interface TaskDetailSheetProps {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onStartFocus: (task: Task) => void;
}

export function TaskDetailSheet({ task, visible, onClose, onStartFocus }: TaskDetailSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const updateTask = useProductivityStore((s) => s.updateTask);
  const removeTask = useProductivityStore((s) => s.removeTask);
  const duplicateTask = useProductivityStore((s) => s.duplicateTask);
  const topTask = useSettingsStore((s) => s.topTask);
  const setTopTask = useSettingsStore((s) => s.setTopTask);
  const rescheduleTask = useProductivityStore((s) => s.rescheduleTask);
  const setTaskReminder = useProductivityStore((s) => s.setTaskReminder);
  const liveRemindAt = useProductivityStore((s) => s.tasks.find((t) => t.id === task?.id)?.remind_at ?? null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priorityIndex, setPriorityIndex] = useState(1);
  const [repeat, setRepeat] = useState<RecurringFrequency | 'none'>('none');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState(0);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [waitingOn, setWaitingOn] = useState('');

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setPriorityIndex(PRIORITIES.indexOf(task.priority));
    setRepeat(task.repeat_frequency ?? 'none');
    setEstimate(task.estimate_minutes ?? 0);
    setDeadline(task.due_date);
    setWaitingOn(task.waiting_on ?? '');
    repo.listSubtasks(task.id).then(setSubtasks);
  }, [task?.id]);

  if (!task) return null;

  const refreshSubtasks = () =>
    repo.listSubtasks(task.id).then((rows) => {
      setSubtasks(rows);
      useProductivityStore.getState().refreshSubtaskCounts();
    });

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    await repo.createSubtask(task.id, newSubtask.trim());
    setNewSubtask('');
    await refreshSubtasks();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        notes: notes || null,
        priority: PRIORITIES[priorityIndex],
        repeat_frequency: repeat === 'none' ? null : repeat,
        repeat_interval: repeat === 'none' ? null : 1,
        estimate_minutes: estimate || null,
        due_date: deadline,
        waiting_on: waitingOn.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTask(task.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={[typography.title2, { color: colors.label, flex: 1 }]}>Task</Text>
          <Pressable
            onPress={async () => {
              const done = task.status !== 'done';
              if (done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await useProductivityStore.getState().toggleTaskDone(task.id, done);
              onClose();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: task.status === 'done' ? colors.tertiaryFill : colors.green,
            }}
          >
            <Icon name={task.status === 'done' ? 'arrow.clockwise' : 'checkmark.circle.fill'} size={16} color={task.status === 'done' ? colors.label : '#fff'} />
            <Text style={[typography.subhead, { color: task.status === 'done' ? colors.label : '#fff', fontWeight: '600', marginLeft: 5 }]}>
              {task.status === 'done' ? 'Not done' : 'Done'}
            </Text>
          </Pressable>
        </View>
        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField label="Notes" placeholder="Optional details" value={notes} onChangeText={setNotes} multiline />
        {notes.split('\n').filter((l) => l.trim()).length >= 2 ? (
          <Pressable
            onPress={async () => {
              // Each line of the notes becomes a checklist step.
              const lines = notes
                .split('\n')
                .map((l) => l.replace(/^\s*([-*•]|\[ ?\]|\d+[.)])\s*/, '').trim())
                .filter(Boolean);
              for (const l of lines) await repo.createSubtask(task.id, l);
              setNotes('');
              await refreshSubtasks();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}
          >
            <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600' }]}>Turn these note lines into checklist steps</Text>
          </Pressable>
        ) : null}

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Schedule · {scheduleLabel(task)}
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={SCHEDULE_OPTIONS}
            selectedId={null}
            onSelect={async (id) => {
              await rescheduleTask(task.id, id as repo.RescheduleTarget);
              onClose();
            }}
          />
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Deadline · {deadline ? `${formatDateKey(deadline)} (${deadlineLabel(deadline)})` : 'None'}
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={DEADLINE_OPTIONS} selectedId={null} onSelect={(id) => setDeadline(deadlineFromOption(id))} />
        </View>

        <TextField label="Waiting on" placeholder="Someone you're waiting for (optional)" value={waitingOn} onChangeText={setWaitingOn} />

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Remind me ·{' '}
          {liveRemindAt ? `${formatRelativeDay(liveRemindAt)} ${formatTime(liveRemindAt)}` : 'Off'}
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={REMIND_OPTIONS}
            selectedId={null}
            onSelect={(id) => setTaskReminder(task.id, reminderTime(id))}
          />
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Time estimate
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={ESTIMATE_OPTIONS} selectedId={String(estimate)} onSelect={(id) => setEstimate(Number(id))} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Priority
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Low', 'Medium', 'High']} selectedIndex={priorityIndex} onChange={setPriorityIndex} />
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Repeat
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={REPEAT_OPTIONS} selectedId={repeat} onSelect={(id) => setRepeat(id as RecurringFrequency | 'none')} />
          {repeat !== 'none' ? (
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 6 }]}>
              When you finish it, it comes back{' '}
              {(() => {
                const base = task.scheduled_date ? new Date(task.scheduled_date + 'T12:00:00') : new Date();
                const next = new Date(base);
                if (repeat === 'daily') next.setDate(next.getDate() + 1);
                else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
                else if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);
                else next.setFullYear(next.getFullYear() + 1);
                return next.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
              })()}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', flex: 1 }]}>
            Checklist{subtasks.length ? ` · ${subtasks.filter((x) => x.is_done).length}/${subtasks.length}` : ''}
          </Text>
          {subtasks.some((x) => !x.is_done) && subtasks.length > 1 ? (
            <Pressable
              onPress={async () => {
                for (const x of subtasks.filter((y) => !y.is_done)) await repo.toggleSubtaskDone(x.id, true);
                await refreshSubtasks();
              }}
              hitSlop={8}
            >
              <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600' }]}>Tick all</Text>
            </Pressable>
          ) : null}
        </View>
        {subtasks.length ? (
          <View style={{ marginBottom: spacing.xs }}>
            <ProgressBar progress={subtasks.filter((x) => x.is_done).length / subtasks.length} color={colors.green} height={5} />
          </View>
        ) : null}
        <View style={{ marginBottom: spacing.md }}>
          {subtasks.map((sub) => (
            <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  repo.toggleSubtaskDone(sub.id, !sub.is_done).then(refreshSubtasks);
                }}
                hitSlop={8}
              >
                <Icon
                  name={sub.is_done ? 'checkmark.circle.fill' : 'circle'}
                  size={20}
                  color={sub.is_done ? colors.green : colors.gray3}
                />
              </Pressable>
              <Text
                style={[
                  typography.body,
                  {
                    flex: 1,
                    marginLeft: spacing.sm,
                    color: sub.is_done ? colors.secondaryLabel : colors.label,
                    textDecorationLine: sub.is_done ? 'line-through' : 'none',
                  },
                ]}
              >
                {sub.title}
              </Text>
              {!sub.is_done ? (
                <Pressable
                  onPress={async () => {
                    // A step that grew into its own job: make it a task in the
                    // same project and drop it from this checklist.
                    await useProductivityStore.getState().addTask({
                      project_id: task.project_id,
                      title: sub.title,
                      notes: `From: ${task.title}`,
                      status: 'todo',
                      priority: task.priority,
                      due_date: null,
                      scheduled_date: task.scheduled_date,
                      sort_order: Date.now(),
                    });
                    await repo.deleteSubtask(sub.id);
                    await refreshSubtasks();
                  }}
                  hitSlop={8}
                  style={{ marginRight: spacing.md }}
                >
                  <Icon name="arrow.up.right" size={16} color={colors.blue} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => repo.deleteSubtask(sub.id).then(refreshSubtasks)} hitSlop={8}>
                <Icon name="xmark" size={16} color={colors.tertiaryLabel} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <TextField
              placeholder="Add a step"
              value={newSubtask}
              onChangeText={setNewSubtask}
              onSubmitEditing={handleAddSubtask}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Pressable onPress={handleAddSubtask} hitSlop={8} style={{ marginLeft: spacing.sm, marginBottom: spacing.md }}>
              <Icon name="plus.circle.fill" size={28} color={colors.blue} />
            </Pressable>
          </View>
        </View>

        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginBottom: spacing.sm }]}>
          Added {formatRelativeDay(task.created_at)}
          {task.completed_at ? ` · done ${formatRelativeDay(task.completed_at)} at ${formatTime(task.completed_at)}` : ''}
          {subtasks.length ? ` · tap ↗ on a step to make it its own task` : ''}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          <Pressable
            onPress={() =>
              Share.share({
                message: [`☐ ${task.title}`, task.due_date ? `Due ${formatDateKey(task.due_date)}` : null, task.notes, ...subtasks.map((st) => `  ${st.is_done ? '☑' : '☐'} ${st.title}`)]
                  .filter(Boolean)
                  .join('\n'),
              })
            }
            hitSlop={8}
            style={{ marginRight: spacing.lg }}
          >
            <Text style={[typography.subhead, { color: colors.blue }]}>Share task</Text>
          </Pressable>
          {task.waiting_on ? (
            <Pressable
              onPress={() => Share.share({ message: `Hi ${task.waiting_on}, any update on "${task.title}"? Thanks!` })}
              hitSlop={8}
            >
              <Text style={[typography.subhead, { color: colors.blue }]}>Nudge {task.waiting_on}</Text>
            </Pressable>
          ) : null}
        </View>
        <Button title="Save" onPress={handleSave} loading={saving} style={{ marginBottom: spacing.sm }} />
        <Button
          title="Start focus timer"
          variant="secondary"
          onPress={() => onStartFocus(task)}
          style={{ marginBottom: spacing.sm }}
        />
        {task.status !== 'done' ? (
          <Button
            title={topTask?.id === task.id && topTask.date === todayKey() ? "Remove as today's top task" : "Make today's top task 🐸"}
            variant="secondary"
            onPress={() => {
              const isTop = topTask?.id === task.id && topTask.date === todayKey();
              setTopTask(isTop ? null : { id: task.id, date: todayKey() });
              onClose();
            }}
            style={{ marginBottom: spacing.sm }}
          />
        ) : null}
        <Button
          title="Duplicate task"
          variant="secondary"
          onPress={async () => {
            await duplicateTask(task.id);
            onClose();
          }}
          style={{ marginBottom: spacing.sm }}
        />
        <Button title="Delete task" variant="destructive" onPress={handleDelete} style={{ marginBottom: spacing.xl }} />
      </ScrollView>
    </Sheet>
  );
}
