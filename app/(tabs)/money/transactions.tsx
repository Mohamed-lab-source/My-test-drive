import React, { useEffect, useMemo, useState } from 'react';
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
import { TextField } from '../../../src/ui/TextField';
import * as financeRepo from '../../../src/db/repositories/finance';
import { allTags, extractTags } from '../../../src/utils/tags';
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
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(null);
  const [tagFilter, setTagFilter] = useState<string>(ALL);
  const tags = useMemo(() => allTags(transactions.map((t) => t.note)), [transactions]);

  // Re-run when the list changes too, so edits/deletes show up in results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      financeRepo.searchTransactionsByNote(q).then((rows) => {
        if (!cancelled) setSearchResults(rows);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, transactions]);

  const filtered = useMemo(() => {
    const typeFilter = TYPE_FILTERS[typeIndex];
    return (searchResults ?? transactions).filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (accountFilter === ALL || t.account_id === accountFilter || t.transfer_to_account_id === accountFilter) &&
        (categoryFilter === ALL || t.category_id === categoryFilter) &&
        (tagFilter === ALL || extractTags(t.note).includes(tagFilter))
    );
  }, [transactions, searchResults, typeIndex, accountFilter, categoryFilter, tagFilter]);

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
        <TextField placeholder="Search notes" value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
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
        {tags.length > 0 ? (
          <View style={{ marginBottom: spacing.xs }}>
            <ChipSelector
              options={[{ id: ALL, label: 'All tags' }, ...tags.slice(0, 20).map((t) => ({ id: t, label: `#${t}` }))]}
              selectedId={tagFilter}
              onSelect={setTagFilter}
            />
          </View>
        ) : null}
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
