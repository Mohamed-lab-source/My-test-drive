import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';

function combineDateAndTime(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const date = new Date(y || new Date().getFullYear(), (m || 1) - 1, d || new Date().getDate(), h || 9, min || 0);
  return date.toISOString();
}

export function AddMeetingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const addMeeting = useProductivityStore((s) => s.addMeeting);

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addMeeting({
        title: title.trim(),
        location: location || null,
        notes: null,
        start_at: combineDateAndTime(date, time),
        end_at: null,
        reminder_minutes_before: 15,
      });
      setTitle('');
      setLocation('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Meeting</Text>
        <TextField label="Title" placeholder="e.g. Sprint planning" value={title} onChangeText={setTitle} autoFocus />
        <TextField label="Location" placeholder="Optional" value={location} onChangeText={setLocation} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Time" placeholder="HH:MM" value={time} onChangeText={setTime} />
          </View>
        </View>
        <Button title="Add meeting" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
