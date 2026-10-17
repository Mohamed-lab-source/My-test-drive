import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoney } from '../../utils/money';

// This month so far vs. the same number of days into last month.
export function SpendingPaceCard() {
  const { colors, typography, spacing } = useTheme();
  const { transactions, fxRates } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const [pace, setPace] = useState<{ now: number; then: number } | null>(null);

  useEffect(() => {
    const d = new Date();
    const startNow = new Date(d.getFullYear(), d.getMonth(), 1);
    const startThen = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const daysInPrev = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    const endThen = new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), daysInPrev) + 1);
    Promise.all([
      repo.listTransactionsInRange(startNow.toISOString(), new Date(d.getTime() + 60000).toISOString()),
      repo.listTransactionsInRange(startThen.toISOString(), endThen.toISOString()),
    ]).then(([a, b]) => {
      const sum = (xs: typeof a) =>
        xs.filter((t) => t.type === 'expense').reduce((s, t) => s + convertToBase(t.amount, t.currency, currency, fxRates), 0);
      setPace({ now: sum(a), then: sum(b) });
    });
  }, [transactions, currency, fxRates]);

  if (!pace || (pace.now === 0 && pace.then === 0)) return null;
  const diff = pace.then > 0 ? pace.now / pace.then - 1 : null;
  const max = Math.max(pace.now, pace.then, 1);
  const bar = (label: string, v: number, color: string) => (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label}</Text>
        <Text style={[typography.caption1, { color: colors.label, fontWeight: '600' }]}>{formatMoney(v, currency)}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.tertiaryFill, marginTop: 2, overflow: 'hidden' }}>
        <View style={{ width: `${(v / max) * 100}%`, height: 6, backgroundColor: color }} />
      </View>
    </View>
  );
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>Spending pace</Text>
      {diff !== null ? (
        <Text style={[typography.subhead, { color: diff > 0.05 ? colors.red : diff < -0.05 ? colors.green : colors.secondaryLabel }]}>
          {Math.abs(diff) <= 0.05
            ? 'About the same as last month at this point'
            : `${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'more' : 'less'} than last month at this point`}
        </Text>
      ) : null}
      {bar('This month so far', pace.now, diff !== null && diff > 0.05 ? colors.red : colors.blue)}
      {bar(`Last month, first ${new Date().getDate()} days`, pace.then, colors.gray)}
    </Card>
  );
}
