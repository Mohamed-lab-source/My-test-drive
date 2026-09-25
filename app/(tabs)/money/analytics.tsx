import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatMoney } from '../../../src/utils/money';
import * as repo from '../../../src/db/repositories/finance';
import type { Transaction } from '../../../src/db/types';

const BAR_MAX_HEIGHT = 100;

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export default function AnalyticsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { categories } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const [loading, setLoading] = useState(true);
  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const [sixMonthTx, setSixMonthTx] = useState<Transaction[]>([]);

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
      const key = t.date.slice(0, 7);
      const bucket = months.find((m) => m.key === key);
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += t.amount;
      else if (t.type === 'expense') bucket.expense += t.amount;
    }
    return months;
  }, [sixMonthTx]);

  const maxTrendValue = Math.max(1, ...monthlyTrend.flatMap((m) => [m.income, m.expense]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Analytics" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {loading ? null : (
          <>
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

            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>This month by category</Text>
            {categoryBreakdown.length === 0 ? (
              <Card>
                <EmptyState icon="chart.pie.fill" title="No spending yet" message="Log an expense to see your breakdown." />
              </Card>
            ) : (
              <Card>
                {categoryBreakdown.map(({ category, amount, share }, i) => (
                  <View key={category?.id ?? i} style={{ marginBottom: i === categoryBreakdown.length - 1 ? 0 : spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[typography.subhead, { color: colors.label }]}>{category?.name ?? 'Uncategorized'}</Text>
                      <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                        {formatMoney(amount, currency)} · {Math.round(share * 100)}%
                      </Text>
                    </View>
                    <ProgressBar progress={share} color={category?.color ?? colors.blue} />
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
