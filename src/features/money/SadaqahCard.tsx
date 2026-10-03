import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { TextField } from '../../ui/TextField';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';

// Categories that count as giving: the seeded "Giving / Sadaqah" plus any the
// user creates with a similar name.
const GIVING = /sadaq|charit|giving|zakat|donat/i;

export function SadaqahCard() {
  const { colors, typography, spacing } = useTheme();
  const { categories, transactions, fxRates } = useFinanceStore();
  const { currency, sadaqahGoal, setSadaqahGoal } = useSettingsStore();
  const [goalInput, setGoalInput] = useState(sadaqahGoal > 0 ? String(fromMinorUnits(sadaqahGoal)) : '');
  const [totals, setTotals] = useState({ month: 0, year: 0 });

  useEffect(() => {
    const ids = new Set(categories.filter((c) => GIVING.test(c.name)).map((c) => c.id));
    const now = new Date();
    repo.listTransactionsInRange(new Date(now.getFullYear(), 0, 1).toISOString(), now.toISOString()).then((txs) => {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      let month = 0;
      let year = 0;
      for (const t of txs) {
        if (t.type !== 'expense' || !t.category_id || !ids.has(t.category_id)) continue;
        const amount = convertToBase(t.amount, t.currency, currency, fxRates);
        year += amount;
        if (new Date(t.date).getTime() >= monthStart) month += amount;
      }
      setTotals({ month, year });
    });
  }, [categories, transactions, currency, fxRates]);

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>Sadaqah</Text>
      <View style={{ flexDirection: 'row', marginVertical: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>This month</Text>
          <Text style={[typography.title3, { color: colors.mint }]}>{formatMoney(totals.month, currency)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>This year</Text>
          <Text style={[typography.title3, { color: colors.label }]}>{formatMoney(totals.year, currency)}</Text>
        </View>
      </View>
      {sadaqahGoal > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ProgressBar progress={Math.min(1, totals.month / sadaqahGoal)} color={colors.mint} />
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
            {totals.month >= sadaqahGoal
              ? 'Monthly goal reached — may Allah accept it'
              : `${formatMoney(sadaqahGoal - totals.month, currency)} to your monthly goal`}
          </Text>
        </View>
      ) : null}
      <TextField
        label={`Monthly goal (${currency})`}
        placeholder="Optional"
        keyboardType="decimal-pad"
        value={goalInput}
        onChangeText={setGoalInput}
        onBlur={() => setSadaqahGoal(toMinorUnits(Number(goalInput) || 0))}
      />
      <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: -spacing.sm }]}>
        Counts expenses in your “Giving / Sadaqah” category (or any category named for charity).
      </Text>
    </Card>
  );
}
