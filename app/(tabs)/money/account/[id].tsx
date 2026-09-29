import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../../src/store/financeStore';
import { Card } from '../../../../src/ui/Card';
import { IconCircle } from '../../../../src/ui/IconCircle';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { TransactionRow } from '../../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../../src/features/money/AddTransactionSheet';
import * as repo from '../../../../src/db/repositories/finance';
import { formatMoney } from '../../../../src/utils/money';
import { localDateKey } from '../../../../src/utils/date';
import type { Transaction } from '../../../../src/db/types';

export default function AccountDetailScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, transactions } = useFinanceStore();
  const account = accounts.find((a) => a.id === id);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!id) return;
    // Transfers *into* this account are stored on the source account.
    Promise.all([repo.listTransactionsForAccount(id), repo.listIncomingTransfers(id)]).then(([own, incoming]) => {
      setRows([...own, ...incoming].sort((a, b) => b.date.localeCompare(a.date)));
    });
  }, [id, transactions]);

  const monthKey = localDateKey(new Date().toISOString()).slice(0, 7);
  const month = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of rows) {
      if (localDateKey(t.date).slice(0, 7) !== monthKey) continue;
      const isIn = t.type === 'income' || (t.type === 'transfer' && t.transfer_to_account_id === id);
      if (isIn) inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow };
  }, [rows, monthKey, id]);

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Account" />
        <EmptyState icon="building.columns.fill" title="Account not found" message="It may have been deleted." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title={account.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconCircle name={account.icon} color={account.color} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'capitalize' }]}>
                {account.type} · {account.currency}
              </Text>
              <Text style={[typography.title1, { color: colors.label }]}>{formatMoney(account.balance, account.currency)}</Text>
            </View>
            <Pressable onPress={() => router.push('/money/accounts')} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>In this month</Text>
              <Text style={[typography.headline, { color: colors.green }]}>{formatMoney(month.inflow, account.currency)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Out this month</Text>
              <Text style={[typography.headline, { color: colors.red }]}>{formatMoney(month.outflow, account.currency)}</Text>
            </View>
          </View>
        </Card>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Transactions</Text>
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="banknote" title="No transactions" message="Nothing has been logged to this account yet." />
          </Card>
        ) : (
          <Card padded={false}>
            {rows.slice(0, 200).map((tx, i, arr) => (
              <TransactionRow key={tx.id} tx={tx} isLast={i === arr.length - 1} onPress={() => setEditing(tx)} />
            ))}
          </Card>
        )}
      </ScrollView>
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
