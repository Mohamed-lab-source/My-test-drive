import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ChipSelector } from '../../ui/ChipSelector';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { formatMoney } from '../../utils/money';
import { formatDateShort } from '../../utils/date';
import type { Transaction } from '../../db/types';

const ROUND_TO = 1000; // 10.00 in minor units

// Rounds every expense since the last move up to the next 10 and offers to
// put the difference into a savings goal.
export function RoundUpCard() {
  const { colors, typography, spacing } = useTheme();
  const { savingsGoals, transactions, contributeToGoal } = useFinanceStore();
  const { currency, roundUpSince, setRoundUpSince } = useSettingsStore();
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const open = savingsGoals.filter((g) => !g.is_completed);
  const [goalId, setGoalId] = useState<string | null>(open[0]?.id ?? null);

  const since = roundUpSince ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  useEffect(() => {
    repo.listTransactionsInRange(since, new Date().toISOString()).then((txs) => setExpenses(txs.filter((t) => t.type === 'expense')));
  }, [since, transactions]);

  const total = useMemo(
    () => expenses.reduce((sum, t) => sum + (Math.ceil(t.amount / ROUND_TO) * ROUND_TO - t.amount), 0),
    [expenses]
  );

  if (open.length === 0 || total <= 0) return null;
  const target = open.find((g) => g.id === goalId) ?? open[0];

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.green + '55' }}>
      <Text style={[typography.footnote, { color: colors.green, fontWeight: '700' }]}>ROUND-UPS</Text>
      <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>
        {formatMoney(total, currency)} in spare change
      </Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
        From {expenses.length} purchase{expenses.length === 1 ? '' : 's'} since {formatDateShort(since)}, each rounded up to the next 10.
      </Text>
      {open.length > 1 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector options={open.map((g) => ({ id: g.id, label: g.name, color: g.color }))} selectedId={target.id} onSelect={setGoalId} />
        </View>
      ) : null}
      <Button
        title={`Move to ${target.name}`}
        onPress={async () => {
          await contributeToGoal(target.id, total, 'Round-ups');
          setRoundUpSince(new Date().toISOString());
        }}
      />
    </Card>
  );
}
