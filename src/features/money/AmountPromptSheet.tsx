import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { toMinorUnits } from '../../utils/money';

interface AmountPromptSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  confirmLabel?: string;
  onSubmit: (amountMinor: number, note?: string) => Promise<void>;
}

export function AmountPromptSheet({ visible, onClose, title, confirmLabel = 'Save', onSubmit }: AmountPromptSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = Number(amount) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(toMinorUnits(Number(amount)), note || undefined);
      setAmount('');
      setNote('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{title}</Text>
        <TextField
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoFocus
          value={amount}
          onChangeText={setAmount}
          style={{ fontSize: 28, fontWeight: '700', height: 60 }}
        />
        <TextField label="Note" placeholder="Optional" value={note} onChangeText={setNote} />
        <Button title={confirmLabel} onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
