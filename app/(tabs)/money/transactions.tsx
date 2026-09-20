import React from 'react';
import { View, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { TransactionRow } from '../../../src/features/money/TransactionRow';

export default function TransactionsScreen() {
  const { colors, spacing } = useTheme();
  const { transactions, removeTransaction } = useFinanceStore();

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="All Transactions" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {transactions.length === 0 ? (
          <EmptyState icon="banknote" title="No transactions yet" />
        ) : (
          <Card padded={false}>
            {transactions.map((tx, i, arr) => (
              <SwipeableRow key={tx.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => removeTransaction(tx.id) }]}>
                <TransactionRow tx={tx} isLast={i === arr.length - 1} />
              </SwipeableRow>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
