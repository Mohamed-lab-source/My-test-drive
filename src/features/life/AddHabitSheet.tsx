import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useLifeStore } from '../../store/lifeStore';
import { accentColors } from '../../theme/colors';

const ICONS = ['book.fill', 'heart.fill', 'sparkles', 'sun.max.fill', 'gamecontroller.fill', 'briefcase.fill'];

export function AddHabitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const addHabit = useLifeStore((s) => s.addHabit);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color] = useState(accentColors[Math.floor(Math.random() * accentColors.length)]);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addHabit({ name: name.trim(), icon, color, sort_order: Date.now() });
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
        <TextField label="Habit" placeholder="e.g. Read Quran, Exercise, Journal" value={name} onChangeText={setName} autoFocus />
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Icon</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={ICONS.map((i) => ({ id: i, label: '', icon: i, color }))} selectedId={icon} onSelect={setIcon} />
        </View>
        <Button title="Add habit" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
