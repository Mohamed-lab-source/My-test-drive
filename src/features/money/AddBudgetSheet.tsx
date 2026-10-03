import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toMinorUnits } from '../../utils/money';

export function AddBudgetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const { categories, budgets, setBudget } = useFinanceStore();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (c) => (c.kind === 'expense' || c.kind === 'both') && !budgets.some((b) => b.category_id === c.id)
      ),
    [categories, budgets]
  );

  const canSave = categoryId && Number(amount) > 0;

  const handleSave = async () => {
    if (!canSave || !categoryId) return;
    setSaving(true);
    try {
      await setBudget(categoryId, toMinorUnits(Number(amount)), currency);
      setCategoryId(null);
      setAmount('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Set a Budget</Text>

        {availableCategories.length === 0 ? (
          <Text style={[typography.body, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
            Every spending category already has a budget.
          </Text>
        ) : (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              Category
            </Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector
                options={availableCategories.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                selectedId={categoryId}
                onSelect={setCategoryId}
              />
            </View>
            <TextField
              label="Monthly limit"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
