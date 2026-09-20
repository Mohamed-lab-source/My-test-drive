import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toMinorUnits } from '../../utils/money';
import { nowIso } from '../../db/client';
import type { RecurringFrequency } from '../../db/types';

const FREQUENCIES: RecurringFrequency[] = ['weekly', 'monthly', 'yearly'];

export function AddRecurringSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, categories, addRecurringRule } = useFinanceStore();

  const [typeIndex, setTypeIndex] = useState(0);
  const type = typeIndex === 0 ? 'expense' : 'income';
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [freqIndex, setFreqIndex] = useState(1);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const relevantCategories = useMemo(
    () => categories.filter((c) => c.kind === 'both' || c.kind === type),
    [categories, type]
  );

  const canSave = name.trim().length > 0 && Number(amount) > 0 && accountId;

  const handleSave = async () => {
    if (!canSave || !accountId) return;
    setSaving(true);
    try {
      const now = nowIso();
      await addRecurringRule({
        name: name.trim(),
        type,
        amount: toMinorUnits(Number(amount)),
        currency,
        category_id: categoryId,
        account_id: accountId,
        frequency: FREQUENCIES[freqIndex],
        interval_count: 1,
        start_date: now,
        next_due_date: now,
        end_date: null,
        is_subscription: type === 'expense' ? 1 : 0,
        icon: 'repeat',
        color: colors.purple,
        reminder_days_before: 1,
        notes: null,
      });
      setName('');
      setAmount('');
      setCategoryId(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Add Recurring</Text>
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Expense', 'Income']} selectedIndex={typeIndex} onChange={setTypeIndex} />
        </View>
        <TextField label="Name" placeholder="e.g. Netflix, Rent, Salary" value={name} onChangeText={setName} />
        <TextField label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Repeats
          </Text>
          <SegmentedControl options={['Weekly', 'Monthly', 'Yearly']} selectedIndex={freqIndex} onChange={setFreqIndex} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Account
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={accounts.map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }))}
            selectedId={accountId}
            onSelect={setAccountId}
          />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Category
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={relevantCategories.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
        </View>
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
