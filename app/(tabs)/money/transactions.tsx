import React from 'react';
import { View, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { useUndoStore } from '../../../src/store/undoStore';

export default function TransactionsScreen() {
  const { colors, spacing } = useTheme();
  const { transactions, removeTransaction, addTransaction } = useFinanceStore();

  const handleDelete = async (tx: (typeof transactions)[number]) => {
    await removeTransaction(tx.id);
    // A raw row re-insert wouldn't redo the balance adjustment removeTransaction
    // just reversed, so undo goes back through addTransaction instead (it gets
    // a new id, but the amount, account and balance effect are identical).
    useUndoStore.getState().show('Transaction deleted', () => {
      const { id, created_at, ...rest } = tx;
      addTransaction(rest);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="All Transactions" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {transactions.length === 0 ? (
          <EmptyState icon="banknote" title="No transactions yet" />
        ) : (
          <Card padded={false}>
            {transactions.map((tx, i, arr) => (
              <SwipeableRow key={tx.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(tx) }]}>
                <TransactionRow tx={tx} isLast={i === arr.length - 1} />
              </SwipeableRow>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
