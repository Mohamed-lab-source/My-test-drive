import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toMinorUnits } from '../../utils/money';
import type { DebtDirection } from '../../db/types';

const DIRECTIONS: DebtDirection[] = ['i_owe', 'owed_to_me'];

export function AddDebtSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const addDebt = useFinanceStore((s) => s.addDebt);

  const [dirIndex, setDirIndex] = useState(0);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = personName.trim().length > 0 && Number(amount) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addDebt({
        direction: DIRECTIONS[dirIndex],
        person_name: personName.trim(),
        principal_amount: toMinorUnits(Number(amount)),
        currency,
        due_date: null,
        notes: notes || null,
      });
      setPersonName('');
      setAmount('');
      setNotes('');
      setDirIndex(0);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Add Debt</Text>
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['I owe them', 'They owe me']} selectedIndex={dirIndex} onChange={setDirIndex} />
        </View>
        <TextField label="Person" placeholder="Name" value={personName} onChangeText={setPersonName} />
        <TextField label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} />
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
