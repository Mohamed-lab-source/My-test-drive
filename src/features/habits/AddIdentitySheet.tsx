import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useHabitsStore } from '../../store/habitsStore';

export function AddIdentitySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const addIdentity = useHabitsStore((s) => s.addIdentity);
  const [statement, setStatement] = useState('');
  const [why, setWhy] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = statement.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addIdentity(statement.trim(), why.trim());
      setStatement('');
      setWhy('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Identity</Text>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          "I am becoming..."
        </Text>
        <TextField label="Identity" placeholder="a healthy person" value={statement} onChangeText={setStatement} autoFocus />
        <TextField label="Why it matters" placeholder="Optional — your deeper motivation" value={why} onChangeText={setWhy} />
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
