import React, { useState } from 'react';
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

export default function SubscriptionsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { recurringRules, postRecurring, removeRecurringRule, skipRecurring, setRecurringPaused, refreshRecurring } =
    useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);

  const handleDelete = async (rule: (typeof recurringRules)[number]) => {
    await removeRecurringRule(rule.id);
    showUndoDelete('recurring_rules', rule, 'Recurring item deleted', refreshRecurring);
  };

  const monthlyTotal = recurringRules
    .filter((r) => r.type === 'expense' && r.frequency === 'monthly')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Subscriptions & Recurring" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {recurringRules.length > 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Monthly recurring expenses</Text>
            <Text style={[typography.title1, { color: colors.label, marginTop: 4 }]}>
              {formatMoney(monthlyTotal, recurringRules[0]?.currency ?? 'USD')}
            </Text>
          </Card>
        ) : null}

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
