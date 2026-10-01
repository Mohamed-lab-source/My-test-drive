import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { TextField } from '../../../src/ui/TextField';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/lists';
import { formatMoney, toMinorUnits } from '../../../src/utils/money';
import type { ShoppingItem } from '../../../src/db/types';

export default function ShoppingScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories, addTransaction } = useFinanceStore();
  const { currency, defaultAccountId } = useSettingsStore();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  const load = useCallback(() => repo.listShoppingItems().then(setItems), []);
  useEffect(() => {
    load();
  }, [load]);

  const open = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);
  const estimate = open.reduce((s, i) => s + (i.est_amount ?? 0), 0);
  const groceries = categories.find((c) => /grocer/i.test(c.name)) ?? categories.find((c) => /shopping/i.test(c.name));

  const addItem = async () => {
    if (!title.trim()) return;
    await repo.createShoppingItem(title.trim(), Number(price) > 0 ? toMinorUnits(Number(price)) : null, groceries?.id ?? null);
    setTitle('');
    setPrice('');
    await load();
  };

  const tick = async (item: ShoppingItem) => {
    Haptics.selectionAsync();
    await repo.setShoppingDone(item.id, !item.is_done);
    await load();
    const account = accounts.find((a) => a.id === defaultAccountId && !a.is_archived) ?? accounts.find((a) => !a.is_archived);
    if (!item.is_done && item.est_amount && account) {
      Alert.alert('Log it?', `Add ${formatMoney(item.est_amount, currency)} for "${item.title}" as an expense?`, [
        { text: 'Just tick', style: 'cancel' },
        {
          text: 'Log expense',
          onPress: () =>
            addTransaction({
              type: 'expense',
              amount: item.est_amount!,
              currency: account.currency,
              account_id: account.id,
              transfer_to_account_id: null,
              category_id: item.category_id,
              recurring_id: null,
              note: item.title,
              date: new Date().toISOString(),
            }),
        },
      ]);
    }
  };

  const row = (item: ShoppingItem) => (
    <SwipeableRow
      key={item.id}
      actions={[
        {
          label: 'Delete',
          color: colors.red,
          onPress: async () => {
            await repo.deleteShoppingItem(item.id);
            await load();
          },
        },
      ]}
    >
      <Pressable
        onPress={() => tick(item)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
      >
        <Icon name={item.is_done ? 'checkmark.circle.fill' : 'circle'} size={24} color={item.is_done ? colors.green : colors.gray3} />
        <Text
          style={[
            typography.body,
            {
              flex: 1,
              marginLeft: spacing.sm,
              color: item.is_done ? colors.secondaryLabel : colors.label,
              textDecorationLine: item.is_done ? 'line-through' : 'none',
            },
          ]}
        >
          {item.title}
        </Text>
        {item.est_amount ? (
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{formatMoney(item.est_amount, currency)}</Text>
        ) : null}
      </Pressable>
    </SwipeableRow>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Shopping list" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 2, marginRight: spacing.sm }}>
            <TextField placeholder="Add an item" value={title} onChangeText={setTitle} onSubmitEditing={addItem} returnKeyType="done" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} onSubmitEditing={addItem} />
          </View>
        </View>
        {estimate > 0 ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            About {formatMoney(estimate, currency)} for {open.length} item{open.length === 1 ? '' : 's'}
          </Text>
        ) : null}
        {items.length === 0 ? (
          <EmptyState icon="cart.fill" title="List is empty" message="Add what you need; tick items off as you shop and log them as expenses in one tap." />
        ) : (
          <>
            {open.length > 0 ? <Card padded={false} style={{ marginBottom: spacing.md }}>{open.map(row)}</Card> : null}
            {done.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase' }]}>In the cart</Text>
                  <Pressable
                    onPress={async () => {
                      for (const i of done) await repo.deleteShoppingItem(i.id);
                      await load();
                    }}
                  >
                    <Text style={[typography.footnote, { color: colors.red }]}>Clear</Text>
                  </Pressable>
                </View>
                <Card padded={false}>{done.map(row)}</Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
