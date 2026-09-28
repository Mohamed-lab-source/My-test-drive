import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { useUndoStore } from '../../../src/store/undoStore';
import type { Transaction, TransactionType } from '../../../src/db/types';

const TYPE_FILTERS: (TransactionType | 'all')[] = ['all', 'expense', 'income', 'transfer'];
const ALL = 'all';

export default function TransactionsScreen() {
  const { colors, spacing } = useTheme();
  const { transactions, accounts, categories, removeTransaction, addTransaction } = useFinanceStore();
  const [typeIndex, setTypeIndex] = useState(0);
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const typeFilter = TYPE_FILTERS[typeIndex];
    return transactions.filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (accountFilter === ALL || t.account_id === accountFilter || t.transfer_to_account_id === accountFilter) &&
        (categoryFilter === ALL || t.category_id === categoryFilter)
    );
  }, [transactions, typeIndex, accountFilter, categoryFilter]);

  const withoutIdentity = (tx: Transaction) => {
    const { id, created_at, ...rest } = tx;
    return rest;
  };

  const handleDelete = async (tx: Transaction) => {
    await removeTransaction(tx.id);
    // A raw row re-insert wouldn't redo the balance adjustment removeTransaction
    // just reversed, so undo goes back through addTransaction instead (it gets
    // a new id, but the amount, account and balance effect are identical).
    useUndoStore.getState().show('Transaction deleted', () => addTransaction(withoutIdentity(tx)));
  };

  const handleRepeat = async (tx: Transaction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addTransaction({ ...withoutIdentity(tx), date: new Date().toISOString() });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="All Transactions" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['All', 'Expense', 'Income', 'Transfer']} selectedIndex={typeIndex} onChange={setTypeIndex} />
        </View>
        <View style={{ marginBottom: spacing.xs }}>
          <ChipSelector
            options={[{ id: ALL, label: 'All accounts' }, ...accounts.map((a) => ({ id: a.id, label: a.name, color: a.color }))]}
            selectedId={accountFilter}
            onSelect={setAccountFilter}
          />
        </View>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={[
              { id: ALL, label: 'All categories' },
              ...categories.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon })),
            ]}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="banknote" title="No transactions" message="Nothing matches these filters." />
        ) : (
          <Card padded={false}>
            {filtered.map((tx, i, arr) => (
              <SwipeableRow
                key={tx.id}
                actions={[
                  { label: 'Repeat', color: colors.blue, onPress: () => handleRepeat(tx) },
                  { label: 'Delete', color: colors.red, onPress: () => handleDelete(tx) },
                ]}
              >
                <TransactionRow tx={tx} isLast={i === arr.length - 1} onPress={() => setEditing(tx)} />
              </SwipeableRow>
            ))}
          </Card>
        )}
      </ScrollView>
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
