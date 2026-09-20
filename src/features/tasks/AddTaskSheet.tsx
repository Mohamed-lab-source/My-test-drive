import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import { todayKey } from '../../db/client';
import type { TaskPriority, TaskStatus } from '../../db/types';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const WHEN_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'later', label: 'Later' },
  { id: 'backlog', label: 'Backlog' },
];

export function AddTaskSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { projects, addTask } = useProductivityStore();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priorityIndex, setPriorityIndex] = useState(1);
  const [when, setWhen] = useState('today');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const status: TaskStatus = when === 'backlog' ? 'backlog' : 'todo';
      await addTask({
        project_id: projectId,
        title: title.trim(),
        notes: notes || null,
        status,
        priority: PRIORITIES[priorityIndex],
        due_date: null,
        scheduled_date: when === 'today' ? todayKey() : null,
        sort_order: Date.now(),
      });
      setTitle('');
      setNotes('');
      setPriorityIndex(1);
      setWhen('today');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Task</Text>
        <TextField label="Title" placeholder="What needs to happen?" value={title} onChangeText={setTitle} autoFocus />
        <TextField label="Notes" placeholder="Optional details" value={notes} onChangeText={setNotes} multiline />

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>When</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={WHEN_OPTIONS} selectedId={when} onSelect={setWhen} />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Priority
          </Text>
          <SegmentedControl options={['Low', 'Medium', 'High']} selectedIndex={priorityIndex} onChange={setPriorityIndex} />
        </View>

        {projects.length > 0 ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              Project
            </Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector
                options={projects.map((p) => ({ id: p.id, label: p.name, color: p.color, icon: p.icon }))}
                selectedId={projectId}
                onSelect={(id) => setProjectId(id === projectId ? null : id)}
              />
            </View>
          </>
        ) : null}

        <Button title="Add task" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
