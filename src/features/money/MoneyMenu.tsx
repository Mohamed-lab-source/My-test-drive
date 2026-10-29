import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';

interface Item {
  label: string;
  icon: string;
  color: keyof ReturnType<typeof useTheme>['colors'];
  href: string;
  badge?: number;
}

// Everything in Money, grouped by what you're trying to do, as a compact
// two-column list instead of a wall of icons.
export function MoneyMenu({ badges }: { badges: { budgets: number; sms: number; flagged: number } }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Plan',
      items: [
        { label: 'Spending plan', icon: 'target', color: 'green', href: '/money/plan' },
        { label: 'Budgets', icon: 'chart.pie.fill', color: 'orange', href: '/money/budgets', badge: badges.budgets },
        { label: 'Savings goals', icon: 'banknote.fill', color: 'mint', href: '/money/savings' },
        { label: 'Challenges', icon: 'trophy.fill', color: 'yellow', href: '/money/challenges' },
      ],
    },
    {
      title: 'Accounts & cards',
      items: [
        { label: 'Accounts', icon: 'building.columns.fill', color: 'blue', href: '/money/accounts' },
        { label: 'Cards & limits', icon: 'creditcard.fill', color: 'purple', href: '/money/limits' },
        { label: 'Every card seen', icon: 'creditcard.fill', color: 'indigo', href: '/money/cards' },
        { label: 'Bank SMS', icon: 'banknote.fill', color: 'red', href: '/money/sms-inbox', badge: badges.sms },
        { label: 'Debts', icon: 'exclamationmark.triangle.fill', color: 'red', href: '/money/debts' },
      ],
    },
    {
      title: 'Bills & spending',
      items: [
        { label: 'Bills & subscriptions', icon: 'repeat', color: 'purple', href: '/money/subscriptions' },
        { label: 'Bills calendar', icon: 'calendar', color: 'indigo', href: '/money/bills-calendar' },
        { label: 'All transactions', icon: 'list.bullet', color: 'gray', href: '/money/transactions' },
        { label: 'Follow-ups', icon: 'flag.fill', color: 'red', href: '/money/flagged', badge: badges.flagged },
        { label: 'Shopping list', icon: 'cart.badge.plus', color: 'green', href: '/money/shopping' },
        { label: 'Receipts', icon: 'camera.fill', color: 'orange', href: '/money/receipts' },
      ],
    },
    {
      title: 'Reports & tools',
      items: [
        { label: 'Analytics', icon: 'chart.bar.fill', color: 'teal', href: '/money/analytics' },
        { label: 'Insights', icon: 'lightbulb.fill', color: 'yellow', href: '/money/insights' },
        { label: 'Year in review', icon: 'chart.line.uptrend.xyaxis', color: 'indigo', href: '/money/year' },
        { label: 'Calculators', icon: 'function', color: 'gray', href: '/money/tools' },
        { label: 'Zakat', icon: 'hands.sparkles.fill', color: 'mint', href: '/money/zakat' },
      ],
    },
  ];

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      {groups.map((g) => (
        <View key={g.title} style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', fontWeight: '600', marginBottom: 6, marginLeft: 4 }]}>
            {g.title}
          </Text>
          <Card padded={false} style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 }}>
            {g.items.map((it) => {
              const tint = colors[it.color] as string;
              return (
                <PressableScale
                  key={it.href}
                  onPress={() => router.push(it.href as never)}
                  scaleTo={0.96}
                  accessibilityRole="button"
                  accessibilityLabel={it.badge ? `${it.label}, ${it.badge} need attention` : it.label}
                  style={{ width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 }}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={it.icon} size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[typography.subhead, { color: colors.label, marginLeft: 10, flex: 1 }]} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {it.badge ? (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                      <Text style={[typography.caption2, { color: '#FFFFFF', fontWeight: '700' }]}>{it.badge}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}
