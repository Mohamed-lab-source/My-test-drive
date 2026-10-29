import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { formatMoney } from '../../utils/money';
import { localDateKey } from '../../utils/date';
import { todayKey } from '../../db/client';
import { convertToBase } from '../../db/repositories/fx';
import { dayOfPeriod, daysLeftIn, monthPeriod } from '../../utils/period';
import { useBudgetStatuses } from './budgets';

// Today's share of what's left in every active budget (each over its own
// period), plus how many days this money month have had no spending.
export function SafeToSpendCard() {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const { budgets, transactions, fxRates } = useFinanceStore(useShallow((s) => ({ budgets: s.budgets, transactions: s.transactions, fxRates: s.fxRates })));
  const statuses = useBudgetStatuses();
  const [days, setDays] = useState<{ noSpendDays: number; daysSoFar: number } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const period = monthPeriod(now);
      const monthTx = await repo.listTransactionsInRange(period.start.toISOString(), now.toISOString());
      const spendDays = new Set(monthTx.filter((t) => t.type === 'expense').map((t) => localDateKey(t.date)));
      const daysSoFar = dayOfPeriod(period, now);
      let noSpendDays = 0;
      for (let d = 0; d < daysSoFar; d++) {
        const day = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() + d);
        if (!spendDays.has(todayKey(day))) noSpendDays++;
      }
      setDays({ noSpendDays, daysSoFar });
    })();
  }, [transactions]);

  const active = budgets.filter((b) => statuses[b.id]?.state === 'active');
  const toBase = (n: number, c: string) => convertToBase(n, c, currency, fxRates);
  const today = active.reduce((sum, b) => sum + toBase(statuses[b.id].perDayLeft, b.currency), 0);
  const left = active.reduce((sum, b) => sum + Math.max(0, toBase(statuses[b.id].left, b.currency)), 0);
  if (!days) return null;
  const state = { ...days, left };
  const hasBudgets = active.length > 0;
  const daysLeft = daysLeftIn(monthPeriod());

  return (
    <Card>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Safe to spend today</Text>
          {hasBudgets ? (
            <>
              <Text style={[typography.title2, { color: state.left > 0 ? colors.green : colors.red, marginTop: 2 }]}>
                {formatMoney(today, currency)}
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                {formatMoney(state.left, currency)} left in budgets · {daysLeft} day{daysLeft === 1 ? '' : 's'} to go
              </Text>
            </>
          ) : (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>Add a budget to see a daily allowance.</Text>
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
