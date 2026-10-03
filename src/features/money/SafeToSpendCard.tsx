import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { formatMoney } from '../../utils/money';
import { localDateKey } from '../../utils/date';
import { todayKey } from '../../db/client';

// What's left across this month's budgets, spread over the days remaining,
// plus how many days this month have had no spending at all.
export function SafeToSpendCard() {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const { budgets, transactions } = useFinanceStore();
  const [state, setState] = useState<{ left: number; spent: number; noSpendDays: number; daysSoFar: number } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTx = await repo.listTransactionsInRange(monthStart.toISOString(), now.toISOString());
      const expenses = monthTx.filter((t) => t.type === 'expense');
      const budgeted = new Set(budgets.map((b) => b.category_id));
      const spentBy = new Map<string, number>();
      for (const t of expenses) if (t.category_id && budgeted.has(t.category_id)) spentBy.set(t.category_id, (spentBy.get(t.category_id) ?? 0) + t.amount);
      const left = budgets.reduce((sum, b) => sum + Math.max(0, b.monthly_limit - (spentBy.get(b.category_id) ?? 0)), 0);
      const spent = Array.from(spentBy.values()).reduce((a, b) => a + b, 0);
      const spendDays = new Set(expenses.map((t) => localDateKey(t.date)));
      let noSpendDays = 0;
      for (let d = 1; d <= now.getDate(); d++) {
        if (!spendDays.has(todayKey(new Date(now.getFullYear(), now.getMonth(), d)))) noSpendDays++;
      }
      setState({ left, spent, noSpendDays, daysSoFar: now.getDate() });
    })();
  }, [budgets, transactions]);

  if (!state) return null;
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const hasBudgets = budgets.length > 0;

  return (
    <Card>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Safe to spend today</Text>
          {hasBudgets ? (
            <>
              <Text style={[typography.title2, { color: state.left > 0 ? colors.green : colors.red, marginTop: 2 }]}>
                {formatMoney(Math.floor(state.left / daysLeft), currency)}
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                {formatMoney(state.left, currency)} left in budgets · {daysLeft} day{daysLeft === 1 ? '' : 's'} to go
              </Text>
            </>
          ) : (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>Set monthly budgets to see a daily allowance.</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>No-spend days</Text>
          <Text style={[typography.title2, { color: colors.label, marginTop: 2 }]}>{state.noSpendDays}</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>of {state.daysSoFar} this month</Text>
        </View>
      </View>
    </Card>
  );
}
