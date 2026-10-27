import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ProgressBar } from '../../../src/ui/ProgressBar';
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
import { estimatePaceCompletionDate, monthlyAmountNeeded } from '../../../src/utils/projection';
import { AddSavingsGoalSheet } from '../../../src/features/money/AddSavingsGoalSheet';
import { RoundUpCard } from '../../../src/features/money/RoundUpCard';
import { AmountPromptSheet } from '../../../src/features/money/AmountPromptSheet';
import { showUndoDelete } from '../../../src/ui/undo';
import * as financeRepo from '../../../src/db/repositories/finance';
import type { SavingsGoal } from '../../../src/db/types';

function SavingsGoalCard({
  goal,
  onContribute,
  onQuick,
  onDelete,
}: {
  goal: SavingsGoal;
  onContribute: () => void;
  onQuick: (amount: number) => void;
  onDelete: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const [completionDate, setCompletionDate] = useState<string | null>(null);

  useEffect(() => {
    financeRepo.listSavingsContributions(goal.id).then((contributions) => {
      setCompletionDate(estimatePaceCompletionDate(goal.target_amount - goal.current_amount, contributions));
    });
  }, [goal.id, goal.current_amount, goal.target_amount]);

  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
  const perMonth = goal.target_date ? monthlyAmountNeeded(goal.target_amount - goal.current_amount, goal.target_date) : null;

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
        {goal.target_date && !goal.is_completed && perMonth !== null ? (
          (() => {
            // Where it should be by now, saving evenly from the start date.
            const start = new Date(goal.created_at).getTime();
            const end = new Date(goal.target_date).getTime();
            const expected = end > start ? goal.target_amount * Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : 0;
            const diff = goal.current_amount - expected;
            if (Math.abs(diff) < goal.target_amount * 0.02) return null;
            return (
              <Text style={[typography.caption1, { color: diff >= 0 ? colors.green : colors.orange, marginTop: 2, fontWeight: '600' }]}>
                {diff >= 0 ? `${formatMoney(diff, goal.currency)} ahead of schedule` : `${formatMoney(-diff, goal.currency)} behind schedule`}
              </Text>
            );
          })()
        ) : null}
        {goal.target_date && !goal.is_completed ? (
          <Text
            style={[
              typography.caption1,
              { color: perMonth === null ? colors.red : colors.blue, marginTop: 2, fontWeight: '600' },
            ]}
          >
            {perMonth === null
              ? `Target date ${formatDateShort(goal.target_date)} has passed`
              : `Save ${formatMoney(perMonth, goal.currency)}/month to reach it by ${formatDateShort(goal.target_date)}`}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <Button title="Add funds" variant="secondary" onPress={onContribute} style={{ paddingHorizontal: spacing.md, marginRight: spacing.sm }} />
          {!goal.is_completed && perMonth ? (
            <Pressable
              onPress={() => onQuick(perMonth)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 6, backgroundColor: goal.color }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ this month</Text>
            </Pressable>
          ) : null}
          {!goal.is_completed
            ? [100, 500, 1000].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => onQuick(n * 100)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 6, backgroundColor: goal.color + '22' }}
                >
                  <Text style={{ color: goal.color, fontWeight: '700' }}>+{n.toLocaleString()}</Text>
                </Pressable>
              ))
            : null}
        </View>
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
        <RoundUpCard />
        {savingsGoals.length === 0 ? (
          <EmptyState icon="target" title="No savings goals" message="Set a goal for your wedding, a big purchase, or an emergency fund." />
        ) : (
          <>
          {(() => {
            const open = savingsGoals.filter((g) => !g.is_completed);
            const saved = savingsGoals.reduce((sum, g) => sum + g.current_amount, 0);
            const target = savingsGoals.reduce((sum, g) => sum + g.target_amount, 0);
            const perMonth = open.reduce((sum, g) => sum + (g.target_date ? monthlyAmountNeeded(g.target_amount - g.current_amount, g.target_date) ?? 0 : 0), 0);
            return (
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600', textTransform: 'uppercase' }]}>
                  {savingsGoals.length} goal{savingsGoals.length === 1 ? '' : 's'} · {savingsGoals.length - open.length} reached
                </Text>
                <Text style={[typography.title2, { color: colors.label, marginTop: 2 }]}>
                  {formatMoney(saved, savingsGoals[0].currency)} <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>saved of {formatMoney(target, savingsGoals[0].currency)}</Text>
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={target ? saved / target : 0} color={colors.green} />
                </View>
                {perMonth > 0 ? (
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                    Dated goals need {formatMoney(perMonth, savingsGoals[0].currency)} a month in total
                  </Text>
                ) : null}
              </Card>
            );
          })()}
          {[...savingsGoals].sort((a, b) => a.is_completed - b.is_completed).map((goal) => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              onContribute={() => setContributingGoal(goal)}
              onQuick={(amount) => contributeToGoal(goal.id, amount, 'Quick add')}
              onDelete={() => handleDelete(goal)}
            />
          ))}
          </>
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
