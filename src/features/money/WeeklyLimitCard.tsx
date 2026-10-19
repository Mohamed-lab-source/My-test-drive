import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { TextField } from '../../ui/TextField';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/finance';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';

// This week's spending against a weekly limit (week starts on the day set in
// Settings), with what's left per remaining day.
export function WeeklyLimitCard() {
  const { colors, typography, spacing } = useTheme();
  const transactions = useFinanceStore((s) => s.transactions);
  const { currency, weeklyLimit, setWeeklyLimit, weekStart } = useSettingsStore();
  const [spent, setSpent] = useState(0);
  const [lastWeek, setLastWeek] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const now = new Date();
  const back = (now.getDay() - weekStart + 7) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);

  useEffect(() => {
    repo.getSpendSince(start.toISOString(), currency).then(setSpent);
    // Last week up to the same weekday, for a fair comparison.
    const prevStart = new Date(start.getTime() - 7 * 86400000);
    const prevEnd = new Date(Date.now() - 7 * 86400000);
    repo
      .listTransactionsInRange(prevStart.toISOString(), prevEnd.toISOString())
      .then((rows) => setLastWeek(rows.filter((t) => t.type === 'expense' && t.currency === currency).reduce((s, t) => s + t.amount, 0)));
  }, [transactions, currency, weekStart]);

  if (!weeklyLimit && !editing) {
    return (
      <Pressable onPress={() => setEditing(true)} style={{ marginBottom: spacing.md }}>
        <Text style={[typography.subhead, { color: colors.blue }]}>+ Set a weekly spending limit</Text>
      </Pressable>
    );
  }
  const daysLeft = 7 - back;
  const left = weeklyLimit - spent;
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.headline, { color: colors.label }]}>This week</Text>
        <Pressable
          onPress={() => {
            setInput(weeklyLimit ? String(fromMinorUnits(weeklyLimit)) : '');
            setEditing(!editing);
          }}
          hitSlop={8}
        >
          <Text style={[typography.subhead, { color: colors.blue }]}>{editing ? 'Cancel' : 'Edit'}</Text>
        </Pressable>
      </View>
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField placeholder={`Weekly limit (${currency}) — 0 to turn off`} keyboardType="decimal-pad" value={input} onChangeText={setInput} autoFocus />
          </View>
          <Pressable
            onPress={() => {
              setWeeklyLimit(toMinorUnits(Number(input) || 0));
              setEditing(false);
            }}
            style={{ paddingTop: 12 }}
          >
            <Text style={[typography.headline, { color: colors.blue }]}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 2 }]}>
            {formatMoney(spent, currency)} of {formatMoney(weeklyLimit, currency)}
          </Text>
          <View style={{ marginTop: 6 }}>
            <ProgressBar progress={spent / weeklyLimit} color={left < 0 ? colors.red : spent / weeklyLimit > 0.8 ? colors.orange : colors.green} />
          </View>
          <Text style={[typography.caption1, { color: left < 0 ? colors.red : colors.secondaryLabel, marginTop: 4 }]}>
            {left < 0
              ? `${formatMoney(-left, currency)} over this week`
              : `${formatMoney(left, currency)} left · ${formatMoney(Math.floor(left / daysLeft), currency)}/day for ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </Text>
          {lastWeek !== null && lastWeek > 0 ? (
            <Text style={[typography.caption1, { color: spent > lastWeek ? colors.orange : colors.green, marginTop: 2 }]}>
              {spent > lastWeek ? '▲' : '▼'} {formatMoney(Math.abs(spent - lastWeek), currency)} vs the same point last week
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}
