import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useDebtPlan } from './useDebtPlan';
import { monthFromNow } from '../../utils/debtFree';

// A link to the debt-free plan with its headline, for the Debts and Cards screens.
export function DebtPlanBanner() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const p = useDebtPlan();
  if (!p.list.length) return null;
  const when = p.result.feasible ? monthFromNow(new Date(), p.result.months - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;
  return (
    <Pressable onPress={() => router.push('/money/debt-plan')} accessibilityRole="button">
      <Card style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.green + '55' }}>
        <Text style={{ fontSize: 24, marginRight: spacing.sm }}>🎯</Text>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headline, { color: colors.label }]}>{p.plan ? (when ? `Debt-free by ${when}` : 'Your debt-free plan') : 'Make a debt-free plan'}</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            {p.fmt(p.total)} across {p.list.length} debt{p.list.length === 1 ? '' : 's'} · what to pay on each this month
          </Text>
        </View>
        <Icon name="chevron.right" size={14} color={colors.tertiaryLabel} />
      </Card>
    </Pressable>
  );
}
