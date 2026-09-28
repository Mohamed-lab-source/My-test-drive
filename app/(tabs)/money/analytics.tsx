import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatMoney } from '../../../src/utils/money';
import { formatDateKey, formatDateShort, localDateKey } from '../../../src/utils/date';
import { forecastCashFlow } from '../../../src/utils/forecast';
import { convertToBase } from '../../../src/db/repositories/fx';
import * as repo from '../../../src/db/repositories/finance';
import type { Transaction } from '../../../src/db/types';

const BAR_MAX_HEIGHT = 100;

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export default function AnalyticsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { categories, accounts, recurringRules, fxRates, netWorthHistory } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const [loading, setLoading] = useState(true);
  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const [sixMonthTx, setSixMonthTx] = useState<Transaction[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
      const nowIso = now.toISOString();
      const [m, s] = await Promise.all([
        repo.listTransactionsInRange(monthStart, nowIso),
        repo.listTransactionsInRange(sixMonthsAgo, nowIso),
      ]);
      setMonthTx(m);
      setSixMonthTx(s);
      setLoading(false);
    })();
  }, []);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    let grandTotal = 0;
    for (const t of monthTx) {
      if (t.type !== 'expense' || !t.category_id) continue;
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
      grandTotal += t.amount;
    }
    return Array.from(totals.entries())
      .map(([categoryId, amount]) => ({
        category: categories.find((c) => c.id === categoryId),
        amount,
        share: grandTotal > 0 ? amount / grandTotal : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx, categories]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, income: 0, expense: 0 });
    }
    for (const t of sixMonthTx) {
      const key = localDateKey(t.date).slice(0, 7);
      const bucket = months.find((m) => m.key === key);
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += t.amount;
      else if (t.type === 'expense') bucket.expense += t.amount;
    }
    return months;
  }, [sixMonthTx]);

  // Six-month spend for the category tapped in the breakdown below.
  const categoryTrend = useMemo(() => {
    if (!expandedCategoryId) return [];
    const byMonth = new Map(monthlyTrend.map((m) => [m.key, 0]));
    for (const t of sixMonthTx) {
      if (t.type !== 'expense' || t.category_id !== expandedCategoryId) continue;
      const key = localDateKey(t.date).slice(0, 7);
      if (byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + t.amount);
    }
    return Array.from(byMonth.entries()).map(([key, amount]) => ({ key, amount }));
  }, [expandedCategoryId, sixMonthTx, monthlyTrend]);
  const categoryTrendMax = Math.max(1, ...categoryTrend.map((m) => m.amount));
  const categoryTrendAvg = categoryTrend.length ? categoryTrend.reduce((s, m) => s + m.amount, 0) / categoryTrend.length : 0;

  const maxTrendValue = Math.max(1, ...monthlyTrend.flatMap((m) => [m.income, m.expense]));

  const netWorth = accounts.reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0);
  const forecast = useMemo(
    () => forecastCashFlow(netWorth, recurringRules, 30, currency, fxRates),
    [netWorth, recurringRules, currency, fxRates]
  );
  const history = netWorthHistory.slice(-30);
  const historyMin = Math.min(...history.map((h) => h.amount));
  const historyRange = Math.max(1, Math.max(...history.map((h) => h.amount)) - historyMin);

  const thisMonth = monthlyTrend[monthlyTrend.length - 1];
  const lastMonth = monthlyTrend[monthlyTrend.length - 2];
  const spendChange = lastMonth.expense > 0 ? (thisMonth.expense - lastMonth.expense) / lastMonth.expense : null;
  const biggestExpense = useMemo(
    () => monthTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0],
    [monthTx]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Analytics" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {loading ? null : (
          <>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Next 30 days</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Projected net worth from recurring items</Text>
              <Text style={[typography.title1, { color: colors.label, marginTop: 2 }]}>{formatMoney(forecast.endBalance, currency)}</Text>
              {forecast.lowDate && forecast.lowBalance < netWorth ? (
                <Text style={[typography.footnote, { color: forecast.lowBalance < 0 ? colors.red : colors.secondaryLabel, marginTop: 2 }]}>
                  Lowest point {formatMoney(forecast.lowBalance, currency)} around {formatDateShort(forecast.lowDate)}
                </Text>
              ) : null}
              {forecast.events.slice(0, 5).map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <Text style={[typography.subhead, { color: colors.secondaryLabel }]} numberOfLines={1}>
                    {formatDateShort(e.date)} · {e.name}
                  </Text>
                  <Text style={[typography.subhead, { color: e.delta >= 0 ? colors.green : colors.label }]}>
                    {e.delta >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(e.delta), currency)}
                  </Text>
                </View>
              ))}
              {forecast.events.length === 0 ? (
                <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  No recurring items due in the next 30 days.
                </Text>
              ) : null}
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Net worth history</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              {history.length < 2 ? (
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  Anchor records your net worth once a day; the chart fills in as you use the app.
                </Text>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80 }}>
                    {history.map((h) => (
                      <View
                        key={h.id}
                        style={{
                          flex: 1,
                          marginHorizontal: 1,
                          borderRadius: 2,
                          backgroundColor: colors.blue,
                          height: Math.max(3, ((h.amount - historyMin) / historyRange) * 80),
                        }}
                      />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                    <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{formatDateKey(history[0].id)}</Text>
                    <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>Today</Text>
                  </View>
                </>
              )}
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Month in review</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Spent so far this month</Text>
              <Text style={[typography.title1, { color: colors.label, marginTop: 2 }]}>{formatMoney(thisMonth.expense, currency)}</Text>
              {spendChange !== null ? (
                <Text style={[typography.footnote, { color: spendChange > 0 ? colors.red : colors.green, marginTop: 2 }]}>
                  {spendChange > 0 ? '▲' : '▼'} {Math.abs(Math.round(spendChange * 100))}% vs. all of last month (
                  {formatMoney(lastMonth.expense, currency)})
                </Text>
              ) : null}
              {categoryBreakdown[0] ? (
                <Text style={[typography.body, { color: colors.label, marginTop: spacing.sm }]}>
                  Top category: <Text style={{ fontWeight: '700' }}>{categoryBreakdown[0].category?.name ?? 'Uncategorized'}</Text> (
                  {Math.round(categoryBreakdown[0].share * 100)}%)
                </Text>
              ) : null}
              {biggestExpense ? (
                <Text style={[typography.body, { color: colors.label, marginTop: 2 }]}>
                  Biggest expense: <Text style={{ fontWeight: '700' }}>{formatMoney(biggestExpense.amount, biggestExpense.currency)}</Text>
                  {biggestExpense.note ? ` · ${biggestExpense.note}` : ''}
                </Text>
              ) : null}
              <Text style={[typography.body, { color: colors.label, marginTop: 2 }]}>
                Net this month:{' '}
                <Text style={{ fontWeight: '700', color: thisMonth.income - thisMonth.expense >= 0 ? colors.green : colors.red }}>
                  {formatMoney(thisMonth.income - thisMonth.expense, currency)}
                </Text>
              </Text>
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>
              Income vs. expense — last 6 months
            </Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: BAR_MAX_HEIGHT + 30 }}>
                {monthlyTrend.map((m) => (
                  <View key={m.key} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_HEIGHT }}>
                      <View
                        style={{
                          width: 8,
                          marginHorizontal: 2,
                          borderRadius: 3,
                          backgroundColor: colors.green,
                          height: Math.max(2, (m.income / maxTrendValue) * BAR_MAX_HEIGHT),
                        }}
                      />
                      <View
                        style={{
                          width: 8,
                          marginHorizontal: 2,
                          borderRadius: 3,
                          backgroundColor: colors.red,
                          height: Math.max(2, (m.expense / maxTrendValue) * BAR_MAX_HEIGHT),
                        }}
                      />
                    </View>
                    <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 4 }]}>{monthLabel(m.key)}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginRight: 4 }} />
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Income</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red, marginRight: 4 }} />
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Expense</Text>
                </View>
              </View>
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: 2 }]}>This month by category</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>Tap a category for its 6-month trend</Text>
            {categoryBreakdown.length === 0 ? (
              <Card>
                <EmptyState icon="chart.pie.fill" title="No spending yet" message="Log an expense to see your breakdown." />
              </Card>
            ) : (
              <Card>
                {categoryBreakdown.map(({ category, amount, share }, i) => {
                  const expanded = !!category && category.id === expandedCategoryId;
                  return (
                    <Pressable
                      key={category?.id ?? i}
                      disabled={!category}
                      onPress={() => setExpandedCategoryId(expanded ? null : category!.id)}
                      style={{ marginBottom: i === categoryBreakdown.length - 1 ? 0 : spacing.md }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={[typography.subhead, { color: colors.label }]}>{category?.name ?? 'Uncategorized'}</Text>
                        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                          {formatMoney(amount, currency)} · {Math.round(share * 100)}%
                        </Text>
                      </View>
                      <ProgressBar progress={share} color={category?.color ?? colors.blue} />
                      {expanded ? (
                        <View style={{ marginTop: spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60 }}>
                            {categoryTrend.map((m) => (
                              <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
                                <View
                                  style={{
                                    width: 14,
                                    borderRadius: 3,
                                    backgroundColor: category.color,
                                    height: Math.max(2, (m.amount / categoryTrendMax) * 60),
                                  }}
                                />
                              </View>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', marginTop: 4 }}>
                            {categoryTrend.map((m) => (
                              <Text key={m.key} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.secondaryLabel }]}>
                                {monthLabel(m.key)}
                              </Text>
                            ))}
                          </View>
                          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                            6-month average {formatMoney(Math.round(categoryTrendAvg), currency)}/month
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
