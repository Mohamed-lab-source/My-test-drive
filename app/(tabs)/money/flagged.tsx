import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney } from '../../../src/utils/money';
import type { Transaction, TransactionFlag } from '../../../src/db/types';

const LABELS: Record<TransactionFlag, { title: string; done: string; hint: string }> = {
  review: { title: '🚩 Check later', done: 'Checked', hint: 'Charges you want to look at again.' },
  reimburse: { title: '💼 Claim back', done: 'Got paid back', hint: 'Work or shared costs someone owes you for.' },
  refund: { title: '↩️ Refund due', done: 'Refund received', hint: 'Returns and cancellations the shop owes you.' },
};

// Follow-ups: transactions flagged to check, claim back or get refunded.
export default function FlaggedScreen() {
  const { colors, typography, spacing } = useTheme();
  const { transactions, accounts, categories, fxRates, updateTransaction, addTransaction } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    repo.listFlaggedTransactions().then(setRows);
  }, [transactions]);

  const total = (f: TransactionFlag) =>
    rows.filter((t) => t.flag === f).reduce((s, t) => s + convertToBase(t.amount, t.currency, currency, fxRates), 0);

  // Money coming back is logged as income into the same account, so the
  // original expense stays in your history and the balance is right again.
  const resolve = (t: Transaction) => {
    const f = t.flag as TransactionFlag;
    if (f === 'review') {
      updateTransaction(t.id, { flag: null });
      return;
    }
    Alert.alert(LABELS[f].done, `Log ${formatMoney(t.amount, t.currency)} coming back into ${accounts.find((a) => a.id === t.account_id)?.name ?? 'the account'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just clear', onPress: () => updateTransaction(t.id, { flag: null }) },
      {
        text: 'Log money in',
        onPress: async () => {
          const cat = categories.find((c) => c.kind !== 'expense' && /refund|other/i.test(c.name));
          await addTransaction({
            type: 'income',
            amount: t.amount,
            currency: t.currency,
            account_id: t.account_id,
            transfer_to_account_id: null,
            category_id: cat?.id ?? null,
            recurring_id: null,
            note: `${f === 'refund' ? 'Refund' : 'Reimbursed'}: ${t.note ?? 'expense'}`,
            date: new Date().toISOString(),
          });
          await updateTransaction(t.id, { flag: null });
        },
      },
    ]);
  };

  const shown = filter === 'all' ? rows : rows.filter((t) => t.flag === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Follow-ups" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {(Object.keys(LABELS) as TransactionFlag[]).map((f) => (
            <Card key={f} style={{ flex: 1, marginHorizontal: 3, padding: spacing.sm }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                {LABELS[f].title}
              </Text>
              <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(total(f), currency)}
              </Text>
            </Card>
          ))}
        </View>
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector
            options={[{ id: 'all', label: `All (${rows.length})` }, ...(Object.keys(LABELS) as TransactionFlag[]).map((f) => ({ id: f, label: LABELS[f].title }))]}
            selectedId={filter}
            onSelect={setFilter}
          />
        </View>
        {filter !== 'all' ? (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>{LABELS[filter as TransactionFlag].hint}</Text>
        ) : null}
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              icon="flag.fill"
              title="Nothing to follow up"
              message="Open any transaction and choose Check later, Claim back or Refund due under Follow up."
            />
          </Card>
        ) : (
          <Card padded={false}>
            {shown.map((t, i) => (
              <View key={t.id}>
                <TransactionRow tx={t} isLast={false} onPress={() => setEditing(t)} />
                <Pressable
                  onPress={() => resolve(t)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.sm,
                    borderBottomWidth: i === shown.length - 1 ? 0 : 1,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>✓ {LABELS[t.flag as TransactionFlag].done}</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
