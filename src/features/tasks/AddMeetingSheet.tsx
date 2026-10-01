import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import { todayKey } from '../../db/client';
import type { Meeting } from '../../db/types';

const REMINDER_OPTIONS = [5, 15, 30, 60];

function combineDateAndTime(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const date = new Date(y || new Date().getFullYear(), (m || 1) - 1, d || new Date().getDate(), h || 9, min || 0);
  return date.toISOString();
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AddMeetingSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Meeting | null }) {
  const { colors, typography, spacing } = useTheme();
  const addMeeting = useProductivityStore((s) => s.addMeeting);
  const updateMeeting = useProductivityStore((s) => s.updateMeeting);
  const addTask = useProductivityStore((s) => s.addTask);

  // Turns the meeting into a to-do for tomorrow, carrying its notes along.
  const createFollowUp = async () => {
    if (!editing) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await addTask({
      project_id: null,
      title: `Follow up: ${editing.title}`,
      notes: notes.trim() || null,
      status: 'todo',
      priority: 'medium',
      due_date: null,
      scheduled_date: todayKey(tomorrow),
      sort_order: Date.now(),
    });
    Alert.alert('Follow-up added', 'A task for tomorrow is in your Tasks list.');
  };

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('09:00');
  const [reminder, setReminder] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(editing?.title ?? '');
    setLocation(editing?.location ?? '');
    setNotes(editing?.notes ?? '');
    setDate(editing ? todayKey(new Date(editing.start_at)) : todayKey());
    setTime(editing ? timeOf(editing.start_at) : '09:00');
    setReminder(editing?.reminder_minutes_before ?? 15);
  }, [visible, editing?.id]);

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = {
        title: title.trim(),
        location: location || null,
        notes: notes || null,
        start_at: combineDateAndTime(date, time),
        reminder_minutes_before: reminder,
      };
      if (editing) {
        await updateMeeting(editing.id, fields);
      } else {
        await addMeeting({ ...fields, end_at: null });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>
          {editing ? 'Edit Meeting' : 'New Meeting'}
        </Text>
        <TextField label="Title" placeholder="e.g. Sprint planning" value={title} onChangeText={setTitle} autoFocus={!editing} />
        <TextField label="Location" placeholder="Optional" value={location} onChangeText={setLocation} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Time" placeholder="HH:MM" value={time} onChangeText={setTime} />
          </View>
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Remind me before
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={REMINDER_OPTIONS.map((m) => ({ id: String(m), label: m === 60 ? '1 hour' : `${m} min` }))}
            selectedId={String(reminder)}
            onSelect={(id) => setReminder(Number(id))}
          />
        </View>
        <TextField label="Notes" placeholder="Agenda, links, dial-in…" value={notes} onChangeText={setNotes} multiline />
        <Button title={editing ? 'Save' : 'Add meeting'} onPress={handleSave} disabled={!canSave} loading={saving} />
        {editing ? (
          <Button title="Create follow-up task" variant="secondary" onPress={createFollowUp} style={{ marginTop: spacing.sm, marginBottom: spacing.xl }} />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
