import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoneyWhole } from '../../utils/money';
import { useSpendingPlan } from './plan';

// The last seven days of everyday spending as bars, with your daily limit
// drawn across them.
export function WeekSpendCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { transactions, fxRates } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const plan = useSpendingPlan();
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const total = transactions
      .filter((t) => t.type === 'expense' && !t.recurring_id && new Date(t.date).getTime() >= d.getTime() && new Date(t.date).getTime() < next)
      .reduce((sum, t) => sum + convertToBase(t.amount, t.currency, currency, fxRates), 0);
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), total, today: i === 6 };
  });
  const week = days.reduce((s, d) => s + d.total, 0);
  const limit = plan?.daily.limit ?? 0;
  const top = Math.max(1, limit * 1.15, ...days.map((d) => d.total));
  const H = 80;
  return (
    <Card onPress={() => router.push('/money/transactions')}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>Last 7 days</Text>
        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
          {formatMoneyWhole(week, currency)} · {formatMoneyWhole(week / 7, currency)}/day
        </Text>
      </View>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm }}>
        {limit > 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: (limit / top) * H, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.orange }} />
        ) : null}
        {days.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                width: '55%',
                height: Math.max(4, (d.total / top) * H),
                borderRadius: 6,
                backgroundColor: limit > 0 && d.total > limit ? colors.red : d.today ? colors.blue : colors.blue + '66',
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {days.map((d, i) => (
          <Text key={i} style={[typography.caption2, { flex: 1, textAlign: 'center', color: d.today ? colors.label : colors.secondaryLabel, fontWeight: d.today ? '700' : '500' }]}>
            {d.label}
          </Text>
        ))}
      </View>
      {limit > 0 ? (
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 6 }]}>
          Dashed line: today's limit {formatMoneyWhole(limit, currency)} · {days.filter((d) => d.total > limit).length} day(s) over
        </Text>
      ) : null}
    </Card>
  );
}
