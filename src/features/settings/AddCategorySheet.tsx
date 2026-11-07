import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { accentColors } from '../../theme/colors';
import type { Category, CategoryKind } from '../../db/types';

const KINDS: CategoryKind[] = ['expense', 'income', 'both'];
export const CATEGORY_ICONS = [
  'cart.fill', 'basket.fill', 'fork.knife', 'cup.and.saucer.fill', 'pizza.fill', 'house.fill', 'key.fill', 'bolt.fill', 'drop.fill', 'flame.fill',
  'wifi', 'iphone', 'car.fill', 'bus.fill', 'tram.fill', 'fuelpump.fill', 'bicycle', 'airplane', 'heart.fill', 'cross.case.fill',
  'pills.fill', 'dumbbell.fill', 'graduationcap.fill', 'book.fill', 'figure.and.child.holdinghands', 'person.2.fill', 'pawprint.fill', 'bag.fill', 'tshirt.fill', 'scissors',
  'gift.fill', 'hands.sparkles.fill', 'moon.stars.fill', 'tv.fill', 'film.fill', 'music.note', 'gamecontroller.fill', 'sportscourt.fill', 'ticket.fill', 'wrench.fill',
  'hammer.fill', 'shippingbox.fill', 'storefront.fill', 'creditcard.fill', 'wallet.fill', 'banknote.fill', 'briefcase.fill', 'building.columns.fill', 'chart.line.uptrend.xyaxis', 'arrow.uturn.left',
  'tag.fill', 'receipt.fill', 'globe', 'leaf.fill', 'sun.max.fill', 'umbrella.fill', 'star.fill', 'sparkles',
];
const COLORS = [...accentColors, '#8E8E93', '#A2845E', '#FF2D55', '#5AC8FA', '#30B0C7', '#32ADE6', '#BF5AF2', '#FFD60A'].filter((c, i, a) => a.indexOf(c) === i);

// Create a category, or edit one: name, spending or income, icon, colour.
export function AddCategorySheet({
  visible,
  onClose,
  editing,
  initialKind,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Category | null;
  initialKind?: CategoryKind;
  onSaved?: (id: string) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const { categories, addCategory, updateCategory } = useFinanceStore(useShallow((s) => ({ categories: s.categories, addCategory: s.addCategory, updateCategory: s.updateCategory })));

  const [name, setName] = useState('');
  const [kindIndex, setKindIndex] = useState(0);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setKindIndex(Math.max(0, KINDS.indexOf(editing?.kind ?? initialKind ?? 'expense')));
    setIcon(editing?.icon ?? CATEGORY_ICONS[0]);
    setColor(editing?.color ?? accentColors[categories.length % accentColors.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing, initialKind]);

  const trimmed = name.trim();
  const duplicate = categories.some((c) => c.id !== editing?.id && !c.is_archived && c.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !duplicate;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { name: trimmed, icon, color, kind: KINDS[kindIndex] });
        onSaved?.(editing.id);
      } else {
        const id = await addCategory({ name: trimmed, icon, color, kind: KINDS[kindIndex], sort_order: categories.length });
        onSaved?.(id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
            <Icon name={icon} size={22} color="#FFFFFF" />
          </View>
          <Text style={[typography.title2, { color: colors.label, flex: 1 }]} numberOfLines={1}>
            {trimmed || (editing ? 'Edit category' : 'New category')}
          </Text>
        </View>
        <TextField label="Name" placeholder="e.g. Kids' school, Freelance" value={name} onChangeText={setName} autoFocus={!editing} />
        {duplicate ? <Text style={[typography.caption1, { color: colors.red, marginTop: -6, marginBottom: spacing.sm }]}>You already have a category with this name.</Text> : null}
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Spending', 'Income', 'Both']} selectedIndex={kindIndex} onChange={setKindIndex} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Icon</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              accessibilityLabel={i}
              style={{ width: 42, height: 42, borderRadius: 12, margin: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: i === icon ? color : colors.tertiaryFill }}
            >
              <Icon name={i} size={19} color={i === icon ? '#FFFFFF' : colors.secondaryLabel} />
            </Pressable>
          ))}
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Colour</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityLabel={`Colour ${c}`}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, marginRight: 10, marginBottom: 10, borderWidth: c === color ? 3 : 0, borderColor: colors.label }}
            />
          ))}
        </View>
        <Button title={editing ? 'Save changes' : 'Add category'} onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
