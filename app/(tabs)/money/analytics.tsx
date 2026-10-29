import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { Heatmap } from '../../../src/ui/Heatmap';
import { formatMoney } from '../../../src/utils/money';
import { formatDateKey, formatDateShort, localDateKey } from '../../../src/utils/date';
import { forecastCashFlow } from '../../../src/utils/forecast';
import { spendingInsights } from '../../../src/utils/insights';
import { convertToBase } from '../../../src/db/repositories/fx';
import * as repo from '../../../src/db/repositories/finance';
import { METHOD_LABELS, methodOf, type PaymentMethod } from '../../../src/utils/paymentMethods';
import type { Transaction } from '../../../src/db/types';
import { currentMonthStart, dayOfPeriod, daysIn as periodDays, monthPeriod } from '../../../src/utils/period';
import { SafeToSpendCard } from '../../../src/features/money/SafeToSpendCard';
import { WeeklyLimitCard } from '../../../src/features/money/WeeklyLimitCard';
import { SpendingPaceCard } from '../../../src/features/money/SpendingPaceCard';
import { CardsSummaryCard } from '../../../src/features/money/CardsSummaryCard';

const BAR_MAX_HEIGHT = 100;

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export default function AnalyticsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { categories, accounts, recurringRules, fxRates, netWorthHistory } = useFinanceStore(useShallow((s) => ({ categories: s.categories, accounts: s.accounts, recurringRules: s.recurringRules, fxRates: s.fxRates, netWorthHistory: s.netWorthHistory })));
  const currency = useSettingsStore((s) => s.currency);
  const [loading, setLoading] = useState(true);
  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const [sixMonthTx, setSixMonthTx] = useState<Transaction[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = currentMonthStart(now).toISOString();
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

  const excluded = useSettingsStore((s) => s.excludedAccounts);
  const netWorth = accounts.filter((a) => !excluded.includes(a.id)).reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0);
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
  const insights = useMemo(() => spendingInsights(sixMonthTx), [sixMonthTx]);

  // Where the money went this month, by the note/merchant on each expense.
  const topMerchants = useMemo(() => {
    const m = new Map<string, { name: string; amount: number; count: number }>();
    for (const t of monthTx) {
      if (t.type !== 'expense' || !t.note?.trim()) continue;
      const key = t.note.trim().toLowerCase();
      const cur = m.get(key) ?? { name: t.note.trim(), amount: 0, count: 0 };
      cur.amount += convertToBase(t.amount, t.currency, currency, fxRates);
      cur.count++;
      m.set(key, cur);
    }
    return Array.from(m.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [monthTx, currency, fxRates]);

  // Daily spend over the last 5 weeks, scaled to the biggest day.
  const dailySpend = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const t of sixMonthTx) {
      if (t.type !== 'expense') continue;
      const key = localDateKey(t.date);
      byDay[key] = (byDay[key] ?? 0) + convertToBase(t.amount, t.currency, currency, fxRates);
    }
    const max = Math.max(1, ...Object.values(byDay));
    const hasData = Object.keys(byDay).length > 0;
    return { values: Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, Math.max(0.15, v / max)])), max: hasData ? max : 0 };
  }, [sixMonthTx, currency, fxRates]);

  const savingsRate = thisMonth.income > 0 ? (thisMonth.income - thisMonth.expense) / thisMonth.income : null;
  // Months of expenses the cash/bank/savings balances would cover, using the
  // average of the previous months that had any spending.
  const pastExpenses = monthlyTrend.slice(0, -1).map((m) => m.expense).filter((e) => e > 0);
  const avgMonthlyExpense = pastExpenses.length ? pastExpenses.reduce((a, b) => a + b, 0) / pastExpenses.length : 0;
  const liquid = accounts
    .filter((a) => !a.is_archived && a.type !== 'credit')
    .reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0);
  const runwayMonths = avgMonthlyExpense > 0 ? liquid / avgMonthlyExpense : null;

  // How each month's spending was paid: credit card, debit/bank or cash.
  const byMethod = useMemo(() => {
    const months = monthlyTrend.map((m) => ({ key: m.key, credit: 0, debit: 0, cash: 0 }));
    for (const t of sixMonthTx) {
      if (t.type !== 'expense') continue;
      const row = months.find((m) => m.key === localDateKey(t.date).slice(0, 7));
      if (!row) continue;
      row[methodOf(accounts.find((a) => a.id === t.account_id))] += convertToBase(t.amount, t.currency, currency, fxRates);
    }
    return months;
  }, [sixMonthTx, accounts, monthlyTrend, currency, fxRates]);
  const methodMax = Math.max(1, ...byMethod.map((m) => m.credit + m.debit + m.cash));

  // Average spend per weekday over the last six months.
  const byWeekday = useMemo(() => {
    const totals = Array(7).fill(0);
    for (const t of sixMonthTx) {
      if (t.type !== 'expense') continue;
      totals[new Date(t.date).getDay()] += convertToBase(t.amount, t.currency, currency, fxRates);
    }
    const first = sixMonthTx.reduce((min, t) => (t.date < min ? t.date : min), new Date().toISOString());
    const weeks = Math.max(1, (Date.now() - new Date(first).getTime()) / (7 * 86400000));
    return totals.map((v) => v / weeks);
  }, [sixMonthTx, currency, fxRates]);
  const weekdayMax = Math.max(1, ...byWeekday);
  const weekdayTop = byWeekday.indexOf(Math.max(...byWeekday));

  // Month-end projection: spending so far, plus the daily pace for the rest
  // of the month, plus recurring bills still due before it ends.
  const projection = useMemo(() => {
    const now = new Date();
    const period = monthPeriod(now);
    const daysInMonth = periodDays(period);
    const day = dayOfPeriod(period, now);
    const end = period.end.toISOString();
    const billsLeft = recurringRules
      .filter((r) => r.is_active && !r.is_paused && r.type === 'expense' && r.next_due_date >= now.toISOString() && r.next_due_date < end)
      .reduce((sum, r) => sum + convertToBase(r.amount, r.currency, currency, fxRates), 0);
    const recurringPosted = monthTx
      .filter((t) => t.type === 'expense' && t.recurring_id)
      .reduce((sum, t) => sum + convertToBase(t.amount, t.currency, currency, fxRates), 0);
    const spent = thisMonth.expense;
    const pace = (spent - recurringPosted) / day;
    return { total: spent + pace * (daysInMonth - day) + billsLeft, daysLeft: daysInMonth - day, billsLeft };
  }, [monthTx, recurringRules, thisMonth.expense, currency, fxRates]);

  const biggestExpense = useMemo(
    () => monthTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0],
    [monthTx]
  );

  const shareSummary = () => {
    const monthName = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const lines = [
      `${monthName} so far`,
      `Income: ${formatMoney(thisMonth.income, currency)}`,
      `Spent: ${formatMoney(thisMonth.expense, currency)}`,
      `Net: ${formatMoney(thisMonth.income - thisMonth.expense, currency)}`,
      savingsRate !== null ? `Savings rate: ${Math.round(savingsRate * 100)}%` : null,
      ...categoryBreakdown.slice(0, 3).map((c) => `• ${c.category?.name ?? 'Uncategorized'}: ${formatMoney(c.amount, currency)}`),
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Analytics" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* This month at a glance: what used to sit on the Money tab. */}
        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>This month</Text>
        <View style={{ marginBottom: spacing.md }}>
          <SafeToSpendCard />
        </View>
        <WeeklyLimitCard />
        <SpendingPaceCard />
        <View style={{ marginBottom: spacing.md }}>
          <CardsSummaryCard />
        </View>
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
              <Pressable onPress={shareSummary} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                <Icon name="square.and.arrow.up" size={16} color={colors.blue} />
                <Text style={[typography.subhead, { color: colors.blue, marginLeft: 6 }]}>Share summary</Text>
              </Pressable>
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Month-end projection</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>At this pace you'll spend</Text>
              <Text style={[typography.title1, { color: colors.label, marginTop: 2 }]}>{formatMoney(Math.round(projection.total), currency)}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                {formatMoney(thisMonth.expense, currency)} so far · {projection.daysLeft} day{projection.daysLeft === 1 ? '' : 's'} left
                {projection.billsLeft > 0 ? ` · ${formatMoney(Math.round(projection.billsLeft), currency)} in bills still due` : ''}
              </Text>
              {lastMonth.expense > 0 ? (
                <Text style={[typography.footnote, { color: projection.total > lastMonth.expense ? colors.red : colors.green, marginTop: 2 }]}>
                  {projection.total > lastMonth.expense ? 'Above' : 'Below'} last month's {formatMoney(lastMonth.expense, currency)}
                </Text>
              ) : null}
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Paid with</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_HEIGHT }}>
                {byMethod.map((m) => (
                  <View key={m.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    {(['cash', 'debit', 'credit'] as PaymentMethod[]).map((k) =>
                      m[k] > 0 ? (
                        <View
                          key={k}
                          style={{
                            width: 18,
                            height: Math.max(2, (m[k] / methodMax) * BAR_MAX_HEIGHT),
                            backgroundColor: k === 'credit' ? colors.purple : k === 'debit' ? colors.blue : colors.green,
                          }}
                        />
                      ) : null
                    )}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                {byMethod.map((m) => (
                  <Text key={m.key} style={[typography.caption2, { color: colors.tertiaryLabel, flex: 1, textAlign: 'center' }]}>
                    {monthLabel(m.key)}
                  </Text>
                ))}
              </View>
              {(['credit', 'debit', 'cash'] as PaymentMethod[]).map((k) => {
                const cur = byMethod[byMethod.length - 1]?.[k] ?? 0;
                return (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={[typography.subhead, { color: k === 'credit' ? colors.purple : k === 'debit' ? colors.blue : colors.green }]}>
                      {METHOD_LABELS[k]}
                    </Text>
                    <Text style={[typography.subhead, { color: colors.label }]}>{formatMoney(Math.round(cur), currency)} this month</Text>
                  </View>
                );
              })}
            </Card>

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Spending by weekday</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80 }}>
                {byWeekday.map((v, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 20,
                        borderRadius: 4,
                        height: Math.max(3, (v / weekdayMax) * 80),
                        backgroundColor: i === weekdayTop && v > 0 ? colors.red : colors.orange + '88',
                      }}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <Text key={d} style={[typography.caption2, { color: colors.tertiaryLabel, flex: 1, textAlign: 'center' }]}>
                    {d}
                  </Text>
                ))}
              </View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
                {byWeekday[weekdayTop] > 0
                  ? `You spend most on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][weekdayTop]} — about ${formatMoney(Math.round(byWeekday[weekdayTop]), currency)} on average.`
                  : 'No spending logged yet.'}
              </Text>
            </Card>

            {topMerchants.length > 0 ? (
              <>
                <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Top places this month</Text>
                <Card style={{ marginBottom: spacing.lg }}>
                  {topMerchants.map((m, i) => (
                    <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                      <Text style={[typography.subhead, { color: colors.tertiaryLabel, width: 22 }]}>{i + 1}</Text>
                      <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginRight: spacing.sm }]}>×{m.count}</Text>
                      <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{formatMoney(m.amount, currency)}</Text>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Daily spending</Text>
            <Card style={{ marginBottom: spacing.lg }}>
              <Heatmap values={dailySpend.values} color={colors.red} weeks={5} />
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
                {dailySpend.max > 0 ? `Darker days cost more · biggest day ${formatMoney(dailySpend.max, currency)}` : 'No spending logged yet.'}
              </Text>
            </Card>

            {insights.length > 0 ? (
              <>
                <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Insights</Text>
                <Card style={{ marginBottom: spacing.lg }}>
                  {insights.map((ins) => {
                    const cat = categories.find((c) => c.id === ins.categoryId);
                    const up = ins.change > 0;
                    return (
                      <View key={ins.categoryId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                        <Text style={{ fontSize: 16, marginRight: spacing.sm }}>{up ? '📈' : '📉'}</Text>
                        <Text style={[typography.subhead, { color: colors.label, flex: 1 }]}>
                          <Text style={{ fontWeight: '700' }}>{cat?.name ?? 'A category'}</Text> is{' '}
                          {ins.spent === 0 ? 'untouched so far' : `${Math.round(Math.abs(ins.change) * 100)}% ${up ? 'above' : 'below'} your usual pace`}
                        </Text>
                        <Text style={[typography.caption1, { color: up ? colors.red : colors.green }]}>{formatMoney(ins.spent, currency)}</Text>
                      </View>
                    );
                  })}
                  <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>
                    Compared with your 3-month average, adjusted for how far into the month we are.
                  </Text>
                </Card>
              </>
            ) : null}

            <View style={{ flexDirection: 'row', marginBottom: spacing.lg, marginHorizontal: -4 }}>
              <Card style={{ flex: 1, marginHorizontal: 4 }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Savings rate</Text>
                <Text
                  style={[
                    typography.title2,
                    { color: savingsRate === null ? colors.tertiaryLabel : savingsRate >= 0 ? colors.green : colors.red, marginTop: 2 },
                  ]}
                >
                  {savingsRate === null ? '—' : `${Math.round(savingsRate * 100)}%`}
                </Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>of this month's income</Text>
              </Card>
              <Card style={{ flex: 1, marginHorizontal: 4 }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Emergency runway</Text>
                <Text style={[typography.title2, { color: colors.label, marginTop: 2 }]}>
                  {runwayMonths === null ? '—' : `${runwayMonths.toFixed(1)} mo`}
                </Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>of spending in cash & savings</Text>
              </Card>
            </View>

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
                          {monthTx
                            .filter((t) => t.type === 'expense' && t.category_id === category.id)
                            .sort((a, b) => b.amount - a.amount)
                            .slice(0, 8)
                            .map((t) => (
                              <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                                <Text style={[typography.footnote, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                                  {formatDateShort(t.date)} · {t.note || 'No note'}
                                </Text>
                                <Text style={[typography.footnote, { color: colors.label, fontWeight: '600' }]}>{formatMoney(t.amount, t.currency)}</Text>
                              </View>
                            ))}
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
