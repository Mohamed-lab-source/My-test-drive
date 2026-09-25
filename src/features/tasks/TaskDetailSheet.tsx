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
import * as repo from '../../db/repositories/productivity';
import type { RecurringFrequency, Subtask, Task, TaskPriority } from '../../db/types';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const REPEAT_OPTIONS: { id: RecurringFrequency | 'none'; label: string }[] = [
  { id: 'none', label: 'Never' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function TaskDetailSheet({ task, visible, onClose }: { task: Task | null; visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const updateTask = useProductivityStore((s) => s.updateTask);
  const removeTask = useProductivityStore((s) => s.removeTask);

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

  const refreshSubtasks = () => repo.listSubtasks(task.id).then(setSubtasks);

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
        <Button title="Delete task" variant="destructive" onPress={handleDelete} style={{ marginBottom: spacing.xl }} />
      </ScrollView>
    </Sheet>
  );
}
