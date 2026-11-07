import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { FAB } from '../../../src/ui/FAB';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { ActionMenu } from '../../../src/ui/ActionMenu';
import { AddCategorySheet } from '../../../src/features/settings/AddCategorySheet';
import { convertToBase } from '../../../src/db/repositories/fx';
import { monthPeriod } from '../../../src/utils/period';
import { formatMoneyWhole } from '../../../src/utils/money';
import type { Category, CategoryKind } from '../../../src/db/types';

// Ready-made categories people often add, one tap each.
const SUGGESTED: Record<'expense' | 'income', { name: string; icon: string; color: string }[]> = {
  expense: [
    { name: 'Rent', icon: 'key.fill', color: '#A2845E' },
    { name: 'Car', icon: 'car.fill', color: '#5856D6' },
    { name: 'Fuel', icon: 'fuelpump.fill', color: '#FF9500' },
    { name: 'Kids & school', icon: 'graduationcap.fill', color: '#007AFF' },
    { name: 'Family support', icon: 'figure.and.child.holdinghands', color: '#FF2D55' },
    { name: "Gam'eya", icon: 'person.2.fill', color: '#30B0C7' },
    { name: 'Sadaqah & zakat', icon: 'hands.sparkles.fill', color: '#34C759' },
    { name: 'Gifts', icon: 'gift.fill', color: '#AF52DE' },
    { name: 'Mobile & internet', icon: 'wifi', color: '#32ADE6' },
    { name: 'Gym & sports', icon: 'dumbbell.fill', color: '#FF3B30' },
    { name: 'Personal care', icon: 'scissors', color: '#FF9500' },
    { name: 'Home repairs', icon: 'wrench.fill', color: '#8E8E93' },
    { name: 'Debt payments', icon: 'arrow.uturn.left', color: '#FF3B30' },
    { name: 'Card fees & interest', icon: 'creditcard.fill', color: '#FF3B30' },
  ],
  income: [
    { name: 'Salary', icon: 'briefcase.fill', color: '#34C759' },
    { name: 'Bonus', icon: 'star.fill', color: '#FFD60A' },
    { name: 'Freelance', icon: 'laptopcomputer', color: '#007AFF' },
    { name: 'Side business', icon: 'storefront.fill', color: '#FF9500' },
    { name: 'Rent income', icon: 'key.fill', color: '#A2845E' },
    { name: "Gam'eya payout", icon: 'person.2.fill', color: '#30B0C7' },
    { name: 'Gifts received', icon: 'gift.fill', color: '#AF52DE' },
    { name: 'Refunds & cashback', icon: 'arrow.uturn.left', color: '#5AC8FA' },
    { name: 'Investment returns', icon: 'chart.line.uptrend.xyaxis', color: '#5856D6' },
  ],
};

export default function CategoriesScreen() {
  const { colors, typography, spacing } = useTheme();
  const { categories, transactions, fxRates, addCategory, updateCategory, deleteCategory } = useFinanceStore(
    useShallow((s) => ({ categories: s.categories, transactions: s.transactions, fxRates: s.fxRates, addCategory: s.addCategory, updateCategory: s.updateCategory, deleteCategory: s.deleteCategory }))
  );
  const currency = useSettingsStore((s) => s.currency);
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const kind: 'expense' | 'income' = tab === 0 ? 'expense' : 'income';

  const stats = useMemo(() => {
    const { start } = monthPeriod(new Date());
    const m = new Map<string, { count: number; month: number; all: number }>();
    for (const t of transactions) {
      if (!t.category_id) continue;
      const x = m.get(t.category_id) ?? { count: 0, month: 0, all: 0 };
      x.all++;
      if (new Date(t.date) >= start) {
        x.count++;
        x.month += convertToBase(t.amount, t.currency, currency, fxRates);
      }
      m.set(t.category_id, x);
    }
    return m;
  }, [transactions, currency, fxRates]);

  const fits = (c: Category, k: CategoryKind) => c.kind === k || c.kind === 'both';
  const active = categories.filter((c) => !c.is_archived && fits(c, kind)).sort((a, b) => (stats.get(b.id)?.month ?? 0) - (stats.get(a.id)?.month ?? 0) || a.sort_order - b.sort_order);
  const archived = categories.filter((c) => c.is_archived && fits(c, kind));
  const have = new Set(categories.filter((c) => !c.is_archived).map((c) => c.name.toLowerCase()));
  const suggestions = SUGGESTED[kind].filter((s) => !have.has(s.name.toLowerCase()));
  const monthTotal = active.reduce((s, c) => s + (stats.get(c.id)?.month ?? 0), 0);

  const remove = (c: Category) => {
    const used = stats.get(c.id)?.all ?? 0;
    if (!used) {
      Alert.alert(`Delete ${c.name}?`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(c.id) },
      ]);
      return;
    }
    setDeleting(c);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Categories" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['Spending', 'Income']} selectedIndex={tab} onChange={setTab} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
          {active.length} {kind === 'expense' ? 'spending' : 'income'} categories · {formatMoneyWhole(monthTotal, currency)} this month. Tap one to edit, swipe to archive or delete.
        </Text>

        <Card padded={false} style={{ marginBottom: spacing.md }}>
          {active.map((c, i) => {
            const st = stats.get(c.id);
            return (
              <SwipeableRow
                key={c.id}
                actions={[
                  { label: 'Archive', color: colors.orange, onPress: () => updateCategory(c.id, { is_archived: 1 }) },
                  { label: 'Delete', color: colors.red, onPress: () => remove(c) },
                ]}
              >
                <Pressable
                  onPress={() => setEditing(c)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: i === active.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${c.name}`}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={c.icon} size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.body, { color: colors.label }]}>{c.name}</Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                      {st?.count ? `${st.count} this month · ${formatMoneyWhole(st.month, currency)}` : st?.all ? `${st.all} in all` : 'Not used yet'}
                      {c.kind === 'both' ? ' · spending & income' : ''}
                    </Text>
                  </View>
                  <Icon name="chevron.right" size={14} color={colors.tertiaryLabel} />
                </Pressable>
              </SwipeableRow>
            );
          })}
          {!active.length ? <Text style={[typography.footnote, { color: colors.secondaryLabel, padding: spacing.md }]}>No categories yet — add one with + or pick a suggestion below.</Text> : null}
        </Card>

        {suggestions.length ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 6 }]}>Suggested — tap to add</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.name}
                  onPress={() => addCategory({ name: s.name, icon: s.icon, color: s.color, kind, sort_order: categories.length })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.secondarySystemGroupedBackground, marginRight: 6, marginBottom: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${s.name}`}
                >
                  <Icon name={s.icon} size={14} color={s.color} />
                  <Text style={[typography.subhead, { color: colors.label, marginLeft: 5 }]}>{s.name}</Text>
                  <Text style={[typography.subhead, { color: colors.blue, marginLeft: 4 }]}>+</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {archived.length ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 6 }]}>Archived</Text>
            <Card padded={false}>
              {archived.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: i === archived.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator }}>
                  <Icon name={c.icon} size={17} color={c.color} />
                  <Text style={[typography.body, { color: colors.secondaryLabel, flex: 1, marginLeft: spacing.sm }]}>{c.name}</Text>
                  <Pressable onPress={() => updateCategory(c.id, { is_archived: 0 })} hitSlop={8}>
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Restore</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>Archived categories keep their past transactions but don't show when you add new ones.</Text>
          </>
        ) : null}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <AddCategorySheet visible={adding || !!editing} editing={editing} initialKind={kind} onClose={() => { setAdding(false); setEditing(null); }} />
      <ActionMenu
        visible={!!deleting}
        title={deleting ? `${deleting.name} is used ${stats.get(deleting.id)?.all ?? 0} times. Move them to…` : undefined}
        onClose={() => setDeleting(null)}
        actions={
          deleting
            ? [
                ...categories
                  .filter((c) => c.id !== deleting.id && !c.is_archived && (c.kind === deleting.kind || c.kind === 'both' || deleting.kind === 'both'))
                  .slice(0, 10)
                  .map((c) => ({ label: `${c.name}, then delete`, icon: c.icon, onPress: () => deleteCategory(deleting.id, c.id) })),
                { label: 'No category, then delete', icon: 'trash', destructive: true, section: true, onPress: () => deleteCategory(deleting.id, null) },
                { label: 'Archive instead', icon: 'archivebox.fill', onPress: () => updateCategory(deleting.id, { is_archived: 1 }) },
              ]
            : []
        }
      />
    </View>
  );
}
