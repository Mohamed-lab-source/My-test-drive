import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { Button } from '../../../src/ui/Button';
import { formatMoney } from '../../../src/utils/money';
import { formatRelativeDay, isOverdue } from '../../../src/utils/date';
import { AddRecurringSheet } from '../../../src/features/money/AddRecurringSheet';
import { showUndoDelete } from '../../../src/ui/undo';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { convertToBase } from '../../../src/db/repositories/fx';
import type { RecurringFrequency } from '../../../src/db/types';
import { detectRecurring } from '../../../src/utils/recurringDetect';
import { advanceDueDate } from '../../../src/db/repositories/finance';

const PER_YEAR: Record<RecurringFrequency, number> = { daily: 365, weekly: 52, monthly: 12, yearly: 1 };

export default function SubscriptionsScreen() {
  const { colors, typography, spacing } = useTheme();
  const {
    recurringRules,
    postRecurring,
    removeRecurringRule,
    skipRecurring,
    setRecurringPaused,
    setRecurringAutoPost,
    refreshRecurring,
    fxRates,
    transactions,
    addRecurringRule,
  } = useFinanceStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const suggestions = useMemo(
    () => detectRecurring(transactions, recurringRules).filter((s) => !dismissed.includes(s.key)),
    [transactions, recurringRules, dismissed]
  );
  const currency = useSettingsStore((s) => s.currency);
  const [addVisible, setAddVisible] = useState(false);

  const handleDelete = async (rule: (typeof recurringRules)[number]) => {
    await removeRecurringRule(rule.id);
    showUndoDelete('recurring_rules', rule, 'Recurring item deleted', refreshRecurring);
  };

  // Every active expense, whatever its cycle, normalised to a yearly cost in
  // the base currency.
  const yearlyTotal = recurringRules
    .filter((r) => r.type === 'expense' && r.is_active && !r.is_paused)
    .reduce((sum, r) => sum + convertToBase(r.amount, r.currency, currency, fxRates) * PER_YEAR[r.frequency], 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Subscriptions & Recurring" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {recurringRules.length > 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Recurring expenses per month</Text>
            <Text style={[typography.title1, { color: colors.label, marginTop: 4 }]}>
              {formatMoney(Math.round(yearlyTotal / 12), currency)}
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
              {formatMoney(Math.round(yearlyTotal), currency)} a year · paused items excluded
            </Text>
          </Card>
        ) : null}

        {suggestions.map((sug) => (
          <Card key={sug.key} style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.purple + '55' }}>
            <Text style={[typography.footnote, { color: colors.purple, fontWeight: '600' }]}>LOOKS RECURRING</Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>
              {sug.name} · {formatMoney(sug.amount, sug.currency)} a month
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
              Charged {sug.count} times, about a month apart. Track it to get reminders and see it in forecasts.
            </Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <Button
                title="Track it"
                onPress={() =>
                  addRecurringRule({
                    name: sug.name,
                    type: 'expense',
                    amount: sug.amount,
                    currency: sug.currency,
                    category_id: sug.categoryId,
                    account_id: sug.accountId,
                    frequency: 'monthly',
                    interval_count: 1,
                    start_date: sug.lastDate,
                    next_due_date: advanceDueDate(sug.lastDate, 'monthly', 1),
                    end_date: null,
                    is_subscription: 1,
                    icon: 'repeat',
                    color: '#AF52DE',
                    reminder_days_before: 1,
                    notes: null,
                  })
                }
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button title="Not recurring" variant="secondary" onPress={() => setDismissed((d) => [...d, sug.key])} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}

        {recurringRules.length === 0 ? (
          <EmptyState icon="repeat" title="No recurring items" message="Track subscriptions, rent, salary, or any repeating expense." />
        ) : (
          recurringRules.map((rule) => (
            <SwipeableRow key={rule.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(rule) }]}>
              <Card style={{ marginBottom: spacing.sm, opacity: rule.is_paused ? 0.5 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name={rule.icon} color={rule.color} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{rule.name}</Text>
                    <Text
                      style={[
                        typography.footnote,
                        { color: isOverdue(rule.next_due_date) ? colors.red : colors.secondaryLabel },
                      ]}
                    >
                      {rule.is_paused ? 'Paused · ' : ''}
                      {rule.auto_post ? 'Auto · ' : ''}
                      {rule.frequency} · next {formatRelativeDay(rule.next_due_date)}
                    </Text>
                  </View>
                  <Text style={[typography.headline, { color: rule.type === 'income' ? colors.green : colors.label }]}>
                    {formatMoney(rule.amount, rule.currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.sm }}>
                  <Button
                    title="Mark as posted"
                    variant="secondary"
                    onPress={() => postRecurring(rule)}
                    style={{ paddingHorizontal: spacing.md }}
                  />
                  <Button
                    title="Skip"
                    variant="secondary"
                    onPress={() => skipRecurring(rule)}
                    style={{ paddingHorizontal: spacing.md }}
                  />
                  <Button
                    title={rule.is_paused ? 'Resume' : 'Pause'}
                    variant="secondary"
                    onPress={() => setRecurringPaused(rule.id, !rule.is_paused)}
                    style={{ paddingHorizontal: spacing.md }}
                  />
                  <Button
                    title={rule.auto_post ? 'Auto-post: on' : 'Auto-post: off'}
                    variant="secondary"
                    onPress={() => setRecurringAutoPost(rule.id, !rule.auto_post)}
                    style={{ paddingHorizontal: spacing.md }}
                  />
                </View>
              </Card>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddRecurringSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
