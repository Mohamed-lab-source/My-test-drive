import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { formatMoney } from '../../../src/utils/money';
import { todayKey } from '../../../src/db/client';
import { AddBudgetSheet } from '../../../src/features/money/AddBudgetSheet';
import { showUndoDelete } from '../../../src/ui/undo';
import type { Budget } from '../../../src/db/types';

export default function BudgetsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { budgets, categories, transactions, removeBudget, refreshBudgets } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);

  const handleDelete = async (budget: Budget) => {
    await removeBudget(budget.id);
    showUndoDelete('budgets', budget, 'Budget deleted', refreshBudgets);
  };

  const monthStart = todayKey().slice(0, 8) + '01';

  const rows = useMemo(
    () =>
      budgets.map((budget) => {
        const category = categories.find((c) => c.id === budget.category_id);
        const spend = transactions
          .filter((t) => t.category_id === budget.category_id && t.type === 'expense' && t.date >= monthStart)
          .reduce((sum, t) => sum + t.amount, 0);
        return { budget, category, spend, progress: budget.monthly_limit > 0 ? spend / budget.monthly_limit : 0 };
      }),
    [budgets, categories, transactions, monthStart]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Budgets" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {rows.length === 0 ? (
          <EmptyState icon="chart.pie.fill" title="No budgets yet" message="Set a monthly limit for a spending category." />
        ) : (
          rows.map(({ budget, category, spend, progress }) => (
            <SwipeableRow key={budget.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(budget) }]}>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name={category?.icon ?? 'ellipsis.circle.fill'} color={category?.color ?? colors.gray} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{category?.name ?? 'Unknown'}</Text>
                    <Text style={[typography.footnote, { color: progress > 1 ? colors.red : colors.secondaryLabel }]}>
                      {formatMoney(spend, budget.currency)} of {formatMoney(budget.monthly_limit, budget.currency)}
                    </Text>
                  </View>
                  {progress > 1 ? (
                    <Text style={[typography.caption1, { color: colors.red, fontWeight: '700' }]}>Over</Text>
                  ) : null}
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={Math.min(1, progress)} color={progress > 1 ? colors.red : category?.color ?? colors.blue} />
                </View>
              </Card>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddBudgetSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
