import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { ProgressRing } from '../../../src/ui/ProgressRing';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { Button } from '../../../src/ui/Button';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort } from '../../../src/utils/date';
import { estimatePaceCompletionDate } from '../../../src/utils/projection';
import { AddSavingsGoalSheet } from '../../../src/features/money/AddSavingsGoalSheet';
import { AmountPromptSheet } from '../../../src/features/money/AmountPromptSheet';
import { showUndoDelete } from '../../../src/ui/undo';
import * as financeRepo from '../../../src/db/repositories/finance';
import type { SavingsGoal } from '../../../src/db/types';

function SavingsGoalCard({ goal, onContribute, onDelete }: { goal: SavingsGoal; onContribute: () => void; onDelete: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const [completionDate, setCompletionDate] = useState<string | null>(null);

  useEffect(() => {
    financeRepo.listSavingsContributions(goal.id).then((contributions) => {
      setCompletionDate(estimatePaceCompletionDate(goal.target_amount - goal.current_amount, contributions));
    });
  }, [goal.id, goal.current_amount, goal.target_amount]);

  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;

  return (
    <SwipeableRow actions={[{ label: 'Delete', color: colors.red, onPress: onDelete }]}>
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ProgressRing progress={progress} color={goal.color} label={`${Math.round(progress * 100)}%`} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>
              {goal.is_completed ? '🎉 ' : ''}
              {goal.name}
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
              {formatMoney(goal.current_amount, goal.currency)} of {formatMoney(goal.target_amount, goal.currency)}
            </Text>
          </View>
        </View>
        {completionDate ? (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
            At this pace, done around {formatDateShort(completionDate)}
          </Text>
        ) : null}
        <Button
          title="Add funds"
          variant="secondary"
          onPress={onContribute}
          style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }}
        />
      </Card>
    </SwipeableRow>
  );
}

export default function SavingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { savingsGoals, contributeToGoal, removeSavingsGoal, refreshSavings } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  const handleDelete = async (goal: SavingsGoal) => {
    await removeSavingsGoal(goal.id);
    showUndoDelete('savings_goals', goal, 'Savings goal deleted', refreshSavings);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Savings Goals" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {savingsGoals.length === 0 ? (
          <EmptyState icon="target" title="No savings goals" message="Set a goal for your wedding, a big purchase, or an emergency fund." />
        ) : (
          savingsGoals.map((goal) => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              onContribute={() => setContributingGoal(goal)}
              onDelete={() => handleDelete(goal)}
            />
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddSavingsGoalSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AmountPromptSheet
        visible={!!contributingGoal}
        onClose={() => setContributingGoal(null)}
        title={`Add funds to ${contributingGoal?.name ?? ''}`}
        confirmLabel="Add"
        onSubmit={async (amount, note) => {
          if (contributingGoal) await contributeToGoal(contributingGoal.id, amount, note);
        }}
      />
    </View>
  );
}
