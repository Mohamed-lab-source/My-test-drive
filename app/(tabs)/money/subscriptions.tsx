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

export default function SubscriptionsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { recurringRules, postRecurring, removeRecurringRule } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);

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
            <SwipeableRow key={rule.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => removeRecurringRule(rule.id) }]}>
              <Card style={{ marginBottom: spacing.sm }}>
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
                      {rule.frequency} · next {formatRelativeDay(rule.next_due_date)}
                    </Text>
                  </View>
                  <Text style={[typography.headline, { color: rule.type === 'income' ? colors.green : colors.label }]}>
                    {formatMoney(rule.amount, rule.currency)}
                  </Text>
                </View>
                <Button
                  title="Mark as posted"
                  variant="secondary"
                  onPress={() => postRecurring(rule)}
                  style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }}
                />
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
