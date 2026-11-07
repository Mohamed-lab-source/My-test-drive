import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoney } from '../../utils/money';
import { monthPeriod, periodLabel } from '../../utils/period';

// Shown during the first week of a month: how last month went.
export function LastMonthCard() {
  const { colors, typography, spacing } = useTheme();
  const { categories, fxRates } = useFinanceStore(useShallow((s) => ({ categories: s.categories, fxRates: s.fxRates })));
  const { currency, recapDismissedMonth, setRecapDismissedMonth } = useSettingsStore(useShallow((s) => ({ currency: s.currency, recapDismissedMonth: s.recapDismissedMonth, setRecapDismissedMonth: s.setRecapDismissedMonth })));
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const visible = now.getDate() <= 7 && recapDismissedMonth !== monthKey;
  const [stats, setStats] = useState<{ income: number; expense: number; top: string | null; prevExpense: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const start = monthPeriod(now, -1).start.toISOString();
      const end = monthPeriod(now).start.toISOString();
      const prevStart = monthPeriod(now, -2).start.toISOString();
      const [txs, prev] = await Promise.all([repo.listTransactionsInRange(start, end), repo.listTransactionsInRange(prevStart, start)]);
      const base = (t: { amount: number; currency: string }) => convertToBase(t.amount, t.currency, currency, fxRates);
      let income = 0;
      let expense = 0;
      const byCat = new Map<string, number>();
      for (const t of txs) {
        if (t.type === 'income') income += base(t);
        if (t.type === 'expense') {
          expense += base(t);
          if (t.category_id) byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + base(t));
        }
      }
      const topId = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      const prevExpense = prev.filter((t) => t.type === 'expense').reduce((s, t) => s + base(t), 0);
      setStats({ income, expense, top: categories.find((c) => c.id === topId)?.name ?? null, prevExpense });
    })();
  }, [visible]);

  if (!visible || !stats || (stats.income === 0 && stats.expense === 0)) return null;
  const monthName = periodLabel(monthPeriod(now, -1));
  const net = stats.income - stats.expense;
  const change = stats.prevExpense > 0 ? (stats.expense - stats.prevExpense) / stats.prevExpense : null;

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.indigo + '55' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[typography.footnote, { color: colors.indigo, fontWeight: '700', flex: 1 }]}>{monthName.toUpperCase()} IN REVIEW</Text>
        <Pressable onPress={() => setRecapDismissedMonth(monthKey)} hitSlop={10}>
          <Icon name="xmark" size={16} color={colors.tertiaryLabel} />
        </Pressable>
      </View>
      <Text style={[typography.headline, { color: colors.label, marginTop: 4 }]}>
        You {net >= 0 ? 'kept' : 'overspent by'} {formatMoney(Math.abs(net), currency)}
      </Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
        In {formatMoney(stats.income, currency)} · out {formatMoney(stats.expense, currency)}
        {change !== null ? ` · spending ${change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% on the month before` : ''}
        {stats.top ? ` · most on ${stats.top}` : ''}
      </Text>
    </Card>
  );
}
