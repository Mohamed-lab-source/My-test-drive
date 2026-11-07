import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { useSettingsStore } from '../../store/settingsStore';
import { useSpendingPlan } from './plan';
import { formatMoneyWhole } from '../../utils/money';

// Today / this week / this month at a glance, from the spending plan.
export function PlanSummaryCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);
  const plan = useSpendingPlan();
  if (!plan) return null;
  const money = (n: number) => formatMoneyWhole(n, currency);
  const rows = [
    { label: 'Today', l: plan.daily },
    { label: 'Week', l: plan.weekly },
    { label: 'Month', l: plan.monthly },
  ];
  const noPlan = plan.monthly.limit === 0;
  return (
    <Card onPress={() => router.push('/money/plan')}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>Spending plan</Text>
        <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600' }]}>{noPlan ? 'Set up ›' : 'Details ›'}</Text>
      </View>
      {noPlan ? (
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 4 }]}>
          Add your income to see how much to save each month and how much you can spend today.
        </Text>
      ) : (
        <>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
            Save {money(plan.saveMonthly)} a month · spend up to {money(plan.monthly.limit)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {rows.map(({ label, l }, i) => {
              const tone = l.progress >= 1 ? colors.red : l.progress >= 0.8 ? colors.orange : colors.green;
              return (
                <View key={label} style={{ flex: 1, marginLeft: i ? spacing.sm : 0 }}>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label} left</Text>
                  <Text style={[typography.headline, { color: l.left >= 0 ? colors.label : colors.red }]} numberOfLines={1} adjustsFontSizeToFit>
                    {l.left >= 0 ? money(l.left) : `−${money(-l.left)}`}
                  </Text>
                  <View style={{ marginTop: 4 }}>
                    <ProgressBar progress={l.progress} color={tone} height={5} />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}
