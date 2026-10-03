import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { accentColors } from '../../theme/colors';
import type { CategoryKind } from '../../db/types';

const KINDS: CategoryKind[] = ['expense', 'income', 'both'];
const ICONS = [
  'cart.fill',
  'house.fill',
  'car.fill',
  'fork.knife',
  'bolt.fill',
  'heart.fill',
  'bag.fill',
  'gift.fill',
  'banknote.fill',
  'briefcase.fill',
  'book.fill',
  'airplane',
];

export function AddCategorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { categories, addCategory } = useFinanceStore();

  const [name, setName] = useState('');
  const [kindIndex, setKindIndex] = useState(0);
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addCategory({ name: name.trim(), icon, color, kind: KINDS[kindIndex], sort_order: categories.length });
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Category</Text>
        <TextField label="Name" placeholder="e.g. Pets" value={name} onChangeText={setName} autoFocus />
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Expense', 'Income', 'Both']} selectedIndex={kindIndex} onChange={setKindIndex} />
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
