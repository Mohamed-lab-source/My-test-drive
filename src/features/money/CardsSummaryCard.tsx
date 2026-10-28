import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatMoney } from '../../utils/money';
import { METHOD_LABELS, spendByMethod, type PaymentMethod } from '../../utils/paymentMethods';
import { statementPeriods } from '../../utils/statement';
import { currentMonthStart } from '../../utils/period';

// This month's spending split by credit card / debit / cash, and what you
// owe on each credit card with its limit used and next due date.
export function CardsSummaryCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, transactions } = useFinanceStore();
  const now = new Date();
  const monthStart = currentMonthStart(now).toISOString();
  const split = spendByMethod(transactions, accounts, currency, monthStart);
  const total = split.credit + split.debit + split.cash;
  const cards = accounts.filter((a) => a.type === 'credit' && !a.is_archived);
  if (total === 0 && cards.length === 0) return null;

  const methodColor: Record<PaymentMethod, string> = { credit: colors.purple, debit: colors.blue, cash: colors.green };

  return (
    <Card>
      <Text style={[typography.headline, { color: colors.label }]}>Credit vs debit</Text>
      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>How you paid this month</Text>
      {total > 0 ? (
        <>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.tertiaryFill }}>
            {(Object.keys(split) as PaymentMethod[]).map((m) =>
              split[m] > 0 ? <View key={m} style={{ flex: split[m], backgroundColor: methodColor[m] }} /> : null
            )}
          </View>
          {(Object.keys(split) as PaymentMethod[]).map((m) => (
            <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={[typography.subhead, { color: colors.label }]}>{METHOD_LABELS[m]}</Text>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                {formatMoney(split[m], currency)} · {Math.round((split[m] / total) * 100)}%
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>No spending logged this month yet.</Text>
      )}
      {cards.map((c) => {
        const owed = Math.max(0, -c.balance);
        const limit = c.credit_limit ?? 0;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        // The nearest payment due date that hasn't passed yet.
        const due = statementPeriods(c, 2)
          .map((p) => p.dueDate)
          .reverse()
          .find((d) => d && d.getTime() >= today);
        return (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: '/money/account/[id]', params: { id: c.id } })}
            style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.separator }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>💳 {c.name}</Text>
              <Text style={[typography.subhead, { color: owed > 0 ? colors.red : colors.green, fontWeight: '600' }]}>
                {owed > 0 ? `${formatMoney(owed, c.currency)} owed` : 'Paid off'}
              </Text>
            </View>
            {limit > 0 ? (
              <View style={{ marginTop: 6 }}>
                <ProgressBar progress={owed / limit} color={owed / limit >= 0.7 ? colors.red : owed / limit >= 0.3 ? colors.orange : colors.green} height={6} />
              </View>
            ) : null}
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
              {[
                limit > 0 ? `${Math.round((owed / limit) * 100)}% of limit` : null,
                due && owed > 0 ? `payment due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : null,
                'tap for statement',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}
