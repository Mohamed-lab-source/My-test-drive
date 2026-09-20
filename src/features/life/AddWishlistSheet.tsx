import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useLifeStore } from '../../store/lifeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toMinorUnits } from '../../utils/money';
import type { WishlistPriority } from '../../db/types';

const PRIORITIES: WishlistPriority[] = ['low', 'medium', 'high'];

export function AddWishlistSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const addWishlistItem = useLifeStore((s) => s.addWishlistItem);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [priorityIndex, setPriorityIndex] = useState(1);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addWishlistItem({
        title: title.trim(),
        price: price ? toMinorUnits(Number(price)) : null,
        currency,
        url: url || null,
        priority: PRIORITIES[priorityIndex],
        status: 'idea',
        notes: notes || null,
      });
      setTitle('');
      setPrice('');
      setUrl('');
      setNotes('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Idea / Wish</Text>
        <TextField label="Title" placeholder="What's the idea?" value={title} onChangeText={setTitle} autoFocus />
        <TextField label="Estimated price" placeholder="Optional" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <TextField label="Link" placeholder="Optional URL" value={url} onChangeText={setUrl} autoCapitalize="none" />
        <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} />
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Priority
          </Text>
          <SegmentedControl options={['Low', 'Medium', 'High']} selectedIndex={priorityIndex} onChange={setPriorityIndex} />
        </View>
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
