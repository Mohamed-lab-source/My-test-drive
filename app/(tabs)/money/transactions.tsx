import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
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
import { findDuplicateIds } from '../../../src/utils/duplicates';
import { useRouter } from 'expo-router';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { useUndoStore } from '../../../src/store/undoStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney, toMinorUnits } from '../../../src/utils/money';
import type { Transaction, TransactionType } from '../../../src/db/types';

const TYPE_FILTERS: (TransactionType | 'all')[] = ['all', 'expense', 'income', 'transfer'];
const ALL = 'all';

const PERIODS = [
  { id: ALL, label: 'Recent' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: '3m', label: '3 months' },
  { id: 'year', label: 'This year' },
];

function periodRange(id: string, weekStart: number): [Date, Date] | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const end = new Date(y, m, now.getDate() + 1);
  switch (id) {
    case 'week': {
      const back = (now.getDay() - weekStart + 7) % 7;
      return [new Date(y, m, now.getDate() - back), end];
    }
    case 'month':
      return [new Date(y, m, 1), end];
    case 'last':
      return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case '3m':
      return [new Date(y, m - 2, 1), end];
    case 'year':
      return [new Date(y, 0, 1), end];
    default:
      return null;
  }
}

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
  const router = useRouter();
  const [dupesOnly, setDupesOnly] = useState(false);
  const [period, setPeriod] = useState(ALL);
  const [periodRows, setPeriodRows] = useState<Transaction[] | null>(null);
  const [sort, setSort] = useState('new');
  const [minAmount, setMinAmount] = useState(0);
  const currency = useSettingsStore((s) => s.currency);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const fxRates = useFinanceStore((s) => s.fxRates);

  // A period reads straight from the database, so it isn't limited to the
  // recent transactions kept in memory.
  useEffect(() => {
    const range = periodRange(period, weekStart);
    if (!range) return setPeriodRows(null);
    financeRepo.listTransactionsInRange(range[0].toISOString(), range[1].toISOString()).then(setPeriodRows);
  }, [period, transactions, weekStart]);
  const duplicates = useMemo(() => findDuplicateIds(transactions), [transactions]);
  const uncategorized = transactions.filter((t) => t.type !== 'transfer' && !t.category_id).length;
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
    const range = periodRange(period, weekStart);
    const list = (searchResults ?? periodRows ?? transactions).filter(
      (t) =>
        (!range || (new Date(t.date) >= range[0] && new Date(t.date) < range[1])) &&
        (minAmount === 0 || t.amount >= toMinorUnits(minAmount)) &&
        (typeFilter === 'all' || t.type === typeFilter) &&
        (accountFilter === ALL || t.account_id === accountFilter || t.transfer_to_account_id === accountFilter) &&
        (categoryFilter === ALL || t.category_id === categoryFilter) &&
        (tagFilter === ALL || extractTags(t.note).includes(tagFilter)) &&
        (!dupesOnly || duplicates.has(t.id))
    );
    if (sort === 'old') return [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (sort === 'big') return [...list].sort((a, b) => b.amount - a.amount);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, searchResults, periodRows, period, weekStart, minAmount, sort, typeIndex, accountFilter, categoryFilter, tagFilter, dupesOnly, duplicates]);

  const totals = useMemo(() => {
    let out = 0;
    let inn = 0;
    for (const t of filtered) {
      const v = convertToBase(t.amount, t.currency, currency, fxRates);
      if (t.type === 'expense') out += v;
      else if (t.type === 'income') inn += v;
    }
    return { out, inn };
  }, [filtered, currency, fxRates]);

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
        {duplicates.size > 0 || uncategorized > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {duplicates.size > 0 ? (
              <Pressable onPress={() => setDupesOnly((v) => !v)} style={{ marginRight: spacing.md, marginBottom: 4 }}>
                <Text style={{ color: colors.orange, fontWeight: '600' }}>
                  {dupesOnly ? '✕ Show all' : `⚠ ${duplicates.size} possible duplicates`}
                </Text>
              </Pressable>
            ) : null}
            {uncategorized > 0 ? (
              <Pressable onPress={() => router.push('/money/uncategorized')} style={{ marginBottom: 4 }}>
                <Text style={{ color: colors.blue, fontWeight: '600' }}>🏷 {uncategorized} need a category</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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

        <View style={{ marginBottom: spacing.xs }}>
          <ChipSelector options={PERIODS} selectedId={period} onSelect={setPeriod} />
        </View>
        <View style={{ marginBottom: spacing.xs }}>
          <ChipSelector
            options={[
              { id: 'new', label: 'Newest' },
              { id: 'old', label: 'Oldest' },
              { id: 'big', label: 'Largest' },
              { id: 'min0', label: 'Any amount' },
              { id: 'min100', label: '100+' },
              { id: 'min500', label: '500+' },
              { id: 'min1000', label: '1,000+' },
            ]}
            selectedId={null}
            onSelect={(id) => (id.startsWith('min') ? setMinAmount(Number(id.slice(3))) : setSort(id))}
          />
        </View>
        <Text style={{ color: colors.secondaryLabel, marginBottom: spacing.sm, fontSize: 13 }}>
          {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
          {sort !== 'new' ? ` · ${sort === 'old' ? 'oldest' : 'largest'} first` : ''}
          {minAmount ? ` · ${minAmount}+` : ''} · out {formatMoney(totals.out, currency)} · in {formatMoney(totals.inn, currency)}
        </Text>

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
