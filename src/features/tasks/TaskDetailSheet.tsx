import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
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
  { id: 'hour', label: 'In 1 hour' },
  { id: 'evening', label: 'This evening' },
  { id: 'tomorrow', label: 'Tomorrow 9 AM' },
  { id: 'clear', label: 'No reminder' },
];

function reminderTime(option: string, now: Date = new Date()): string | null {
  if (option === 'hour') return new Date(now.getTime() + 3600000).toISOString();
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

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setPriorityIndex(PRIORITIES.indexOf(task.priority));
    setRepeat(task.repeat_frequency ?? 'none');
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
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Task</Text>
        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField label="Notes" placeholder="Optional details" value={notes} onChangeText={setNotes} multiline />

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
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Checklist
        </Text>
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
