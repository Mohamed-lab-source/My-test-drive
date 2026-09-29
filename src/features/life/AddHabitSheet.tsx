import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useHabitsStore } from '../../store/habitsStore';
import { accentColors } from '../../theme/colors';
import { HABIT_REMINDER_TIMES, requestNotificationPermission } from '../../notifications/scheduler';
import { useSettingsStore } from '../../store/settingsStore';
import { formatClock } from '../../utils/date';

const ICONS = ['flame.fill', 'book.fill', 'heart.fill', 'sparkles', 'sun.max.fill', 'moon.stars.fill', 'hands.sparkles.fill'];

export function AddHabitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { habits, addHabit } = useHabitsStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [remind, setRemind] = useState('none');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (remind !== 'none' && !useSettingsStore.getState().notificationsEnabled) await requestNotificationPermission();
      await addHabit({ name: name.trim(), icon, color, sort_order: habits.length, remind_time: remind === 'none' ? null : remind });
      setName('');
      setRemind('none');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Habit</Text>
        <TextField label="Name" placeholder="e.g. Read, Exercise, No sugar" value={name} onChangeText={setName} autoFocus />
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Daily reminder</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={[{ id: 'none', label: 'None' }, ...HABIT_REMINDER_TIMES.map((t) => ({ id: t, label: formatClock(t) }))]}
            selectedId={remind}
            onSelect={setRemind}
          />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Icon</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={ICONS.map((i) => ({ id: i, label: '', icon: i, color }))} selectedId={icon} onSelect={setIcon} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {accentColors.map((c) => (
            <View
              key={c}
              onTouchEnd={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c,
                marginRight: 10,
                marginBottom: 10,
                borderWidth: c === color ? 3 : 0,
                borderColor: colors.label,
              }}
            />
          ))}
        </View>
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
