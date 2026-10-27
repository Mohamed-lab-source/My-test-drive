import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { MiniBars } from '../../../src/ui/MiniBars';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort, localDateKey } from '../../../src/utils/date';
import type { Transaction } from '../../../src/db/types';

// Everything spent at one merchant: totals, how often, and month by month.
export default function MerchantScreen() {
  const { colors, typography, spacing } = useTheme();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { transactions, fxRates, categories } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!name) return;
    const key = name.toLowerCase();
    repo.searchTransactionsByNote(name).then((list) =>
      setRows(list.filter((t) => t.type === 'expense' && t.note?.replace(/\s*\([A-Z]{3} [\d.,]+\)$/, '').trim().toLowerCase() === key))
    );
  }, [name, transactions]);

  const stats = useMemo(() => {
    const v = (t: Transaction) => convertToBase(t.amount, t.currency, currency, fxRates);
    const total = rows.reduce((s, t) => s + v(t), 0);
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = first && last ? (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000 : 0;
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        key,
        label: d.toLocaleDateString(undefined, { month: 'narrow' }),
        value: rows.filter((t) => localDateKey(t.date).startsWith(key)).reduce((s, t) => s + v(t), 0),
      };
    });
    const catCounts = new Map<string, number>();
    for (const t of rows) if (t.category_id) catCounts.set(t.category_id, (catCounts.get(t.category_id) ?? 0) + 1);
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const thisMonth = months[11].value;
    const lastMonth = months[10].value;
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
    const lastYear = rows.filter((t) => t.date >= yearAgo).reduce((s, t) => s + v(t), 0);
    return {
      thisMonth,
      lastMonth,
      lastYear,
      total,
      count: rows.length,
      avg: rows.length ? total / rows.length : 0,
      biggest: rows.reduce((m, t) => Math.max(m, v(t)), 0),
      first,
      last,
      every: rows.length > 1 ? Math.max(1, Math.round(span / (rows.length - 1))) : null,
      months,
      category: categories.find((c) => c.id === topCat)?.name ?? null,
    };
  }, [rows, currency, fxRates, categories]);

  const stat = (label: string, value: string) => (
    <View style={{ width: '50%', marginBottom: spacing.sm }}>
      <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label}</Text>
      <Text style={[typography.headline, { color: colors.label }]}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title={name ?? 'Merchant'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {stat('Total spent', formatMoney(stats.total, currency))}
            {stat('Visits', String(stats.count))}
            {stat('Average', formatMoney(Math.round(stats.avg), currency))}
            {stat('Biggest', formatMoney(stats.biggest, currency))}
            {stat('First', stats.first ? formatDateShort(stats.first.date) : '—')}
            {stat('Most recent', stats.last ? formatDateShort(stats.last.date) : '—')}
          </View>
          {stats.every ? (
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
              About every {stats.every} day{stats.every === 1 ? '' : 's'}
              {stats.category ? ` · usually ${stats.category}` : ''}
            </Text>
          ) : null}
        </Card>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {stat('This month', formatMoney(stats.thisMonth, currency))}
            {stat('Last month', formatMoney(stats.lastMonth, currency))}
          </View>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
            {formatMoney(stats.lastYear, currency)} in the last 12 months
            {stats.lastYear > 0 ? ` · about ${formatMoney(Math.round(stats.lastYear / 12), currency)} a month` : ''}
          </Text>
        </Card>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Last 12 months</Text>
          <MiniBars data={stats.months} color={colors.orange} height={70} />
        </Card>
        <Card padded={false}>
          {[...rows]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((t, i, arr) => (
              <TransactionRow key={t.id} tx={t} isLast={i === arr.length - 1} onPress={() => setEditing(t)} />
            ))}
        </Card>
      </ScrollView>
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
