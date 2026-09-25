import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useHabitsStore } from '../../store/habitsStore';
import { accentColors } from '../../theme/colors';

const ICONS = ['flame.fill', 'book.fill', 'heart.fill', 'sparkles', 'sun.max.fill', 'moon.stars.fill', 'hands.sparkles.fill'];

export function AddHabitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { habits, addHabit } = useHabitsStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addHabit({ name: name.trim(), icon, color, sort_order: habits.length });
      setName('');
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
