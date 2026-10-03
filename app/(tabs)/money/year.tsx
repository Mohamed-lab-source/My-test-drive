import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { MiniBars } from '../../../src/ui/MiniBars';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort, localDateKey } from '../../../src/utils/date';
import type { Transaction } from '../../../src/db/types';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function YearReviewScreen() {
  const { colors, typography, spacing } = useTheme();
  const { categories, fxRates } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    repo.listTransactionsInRange(new Date(year, 0, 1).toISOString(), new Date(year + 1, 0, 1).toISOString()).then(setTxs);
  }, [year]);

  const stats = useMemo(() => {
    const base = (t: Transaction) => convertToBase(t.amount, t.currency, currency, fxRates);
    const monthly = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    const byCat = new Map<string, number>();
    let biggest: Transaction | null = null;
    for (const t of txs) {
      const m = Number(localDateKey(t.date).slice(5, 7)) - 1;
      if (t.type === 'income') monthly[m].income += base(t);
      if (t.type === 'expense') {
        monthly[m].expense += base(t);
        if (t.category_id) byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + base(t));
        if (!biggest || base(t) > base(biggest)) biggest = t;
      }
    }
    const income = monthly.reduce((s, m) => s + m.income, 0);
    const expense = monthly.reduce((s, m) => s + m.expense, 0);
    const active = monthly.map((m, i) => ({ ...m, i })).filter((m) => m.expense > 0);
    const priciest = active.sort((a, b) => b.expense - a.expense)[0];
    const cheapest = active.sort((a, b) => a.expense - b.expense)[0];
    const top = Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, amount]) => ({ category: categories.find((c) => c.id === id), amount }));
    return { monthly, income, expense, priciest, cheapest, top, biggest: biggest as Transaction | null, count: txs.length };
  }, [txs, categories, currency, fxRates]);

  const monthName = (i: number) => new Date(year, i, 1).toLocaleDateString(undefined, { month: 'long' });
  const net = stats.income - stats.expense;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Year in review" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({ id: String(y), label: String(y) }))}
            selectedId={String(year)}
            onSelect={(id) => setYear(Number(id))}
          />
        </View>
        {stats.count === 0 ? (
          <Card>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>No transactions logged in {year}.</Text>
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: 'row', marginHorizontal: -4, marginBottom: spacing.md }}>
              {[
                { label: 'Income', value: stats.income, color: colors.green },
                { label: 'Spent', value: stats.expense, color: colors.red },
                { label: 'Net', value: net, color: net >= 0 ? colors.green : colors.red },
              ].map((s) => (
                <Card key={s.label} style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{s.label}</Text>
                  <Text style={[typography.subhead, { color: s.color, fontWeight: '700', marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(s.value, currency)}
                  </Text>
                </Card>
              ))}
            </View>

            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Spending by month</Text>
              <MiniBars
                data={stats.monthly.map((m, i) => ({ key: String(i), label: MONTHS[i], value: m.expense }))}
                color={colors.red}
                height={90}
                highlightLast={false}
              />
              {stats.income > 0 ? (
                <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
                  You kept {Math.round((net / stats.income) * 100)}% of what came in.
                </Text>
              ) : null}
            </Card>

            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Highlights</Text>
              {stats.priciest ? (
                <Text style={[typography.body, { color: colors.label, marginTop: 4 }]}>
                  📈 Biggest month: <Text style={{ fontWeight: '700' }}>{monthName(stats.priciest.i)}</Text> ({formatMoney(stats.priciest.expense, currency)})
                </Text>
              ) : null}
              {stats.cheapest && stats.cheapest.i !== stats.priciest?.i ? (
                <Text style={[typography.body, { color: colors.label, marginTop: 4 }]}>
                  📉 Lightest month: <Text style={{ fontWeight: '700' }}>{monthName(stats.cheapest.i)}</Text> ({formatMoney(stats.cheapest.expense, currency)})
                </Text>
              ) : null}
              {stats.biggest ? (
                <Text style={[typography.body, { color: colors.label, marginTop: 4 }]}>
                  🧾 Biggest purchase: <Text style={{ fontWeight: '700' }}>{formatMoney(stats.biggest.amount, stats.biggest.currency)}</Text>
                  {stats.biggest.note ? ` · ${stats.biggest.note}` : ''} ({formatDateShort(stats.biggest.date)})
                </Text>
              ) : null}
              <Text style={[typography.body, { color: colors.label, marginTop: 4 }]}>🔢 {stats.count} transactions logged</Text>
            </Card>

            {stats.top.length > 0 ? (
              <Card>
                <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Top categories</Text>
                {stats.top.map(({ category, amount }, i) => (
                  <View key={category?.id ?? i} style={{ marginBottom: i === stats.top.length - 1 ? 0 : spacing.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[typography.subhead, { color: colors.label }]}>{category?.name ?? 'Other'}</Text>
                      <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                        {formatMoney(amount, currency)} · {Math.round((amount / stats.expense) * 100)}%
                      </Text>
                    </View>
                    <ProgressBar progress={amount / stats.expense} color={category?.color ?? colors.blue} />
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
