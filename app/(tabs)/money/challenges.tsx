import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from '../../../src/utils/haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Button } from '../../../src/ui/Button';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { formatMoney, toMinorUnits } from '../../../src/utils/money';
import { localDateKey } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import type { Transaction } from '../../../src/db/types';

// 52-week savings challenge and a monthly no-spend-days challenge.
export default function ChallengesScreen() {
  const { colors, typography, spacing } = useTheme();
  const { transactions } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions })));
  const { currency, challenge52, setChallenge52, noSpendChallenge, setNoSpendChallenge } = useSettingsStore(useShallow((s) => ({ currency: s.currency, challenge52: s.challenge52, setChallenge52: s.setChallenge52, noSpendChallenge: s.noSpendChallenge, setNoSpendChallenge: s.setNoSpendChallenge })));
  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const now = new Date();
  const monthKey = todayKey().slice(0, 7);

  useEffect(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    repo.listTransactionsInRange(start, new Date(Date.now() + 86400000).toISOString()).then(setMonthTx);
  }, [transactions]);

  // ---------- 52 weeks: week n saves n × unit ----------
  const unit = challenge52?.unit ?? 0;
  const done = challenge52?.done ?? [];
  const saved = done.reduce((s, w) => s + w * unit, 0);
  const goal = ((52 * 53) / 2) * unit;
  const currentWeek = challenge52
    ? Math.min(52, Math.floor((Date.now() - new Date(challenge52.start).getTime()) / (7 * 86400000)) + 1)
    : 0;
  const toggleWeek = (w: number) => {
    if (!challenge52) return;
    Haptics.selectionAsync();
    setChallenge52({ ...challenge52, done: done.includes(w) ? done.filter((x) => x !== w) : [...done, w] });
  };

  // ---------- No-spend days this month ----------
  const spendDays = useMemo(
    () => new Set(monthTx.filter((t) => t.type === 'expense' && !t.recurring_id).map((t) => localDateKey(t.date))),
    [monthTx]
  );
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const key = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
    return { day: i + 1, key, past: i + 1 <= now.getDate(), free: !spendDays.has(key) };
  });
  const freeSoFar = days.filter((d) => d.past && d.free).length;
  const challengeOn = noSpendChallenge?.month === monthKey;
  const target = challengeOn ? noSpendChallenge!.target : 0;
  const daysLeft = daysInMonth - now.getDate();

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Challenges" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>No-spend days</Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
            Days this month with no spending (bills don't count): <Text style={{ color: colors.label, fontWeight: '700' }}>{freeSoFar}</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
            {days.map((d) => (
              <View
                key={d.key}
                style={{
                  width: 32,
                  height: 32,
                  margin: 2,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: !d.past ? colors.tertiaryFill : d.free ? colors.green : colors.red + '33',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: d.past && d.free ? '#fff' : colors.label }}>{d.day}</Text>
              </View>
            ))}
          </View>
          {challengeOn ? (
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar progress={freeSoFar / target} color={colors.green} />
              <Text style={[typography.footnote, { color: freeSoFar >= target ? colors.green : colors.secondaryLabel, marginTop: 4 }]}>
                {freeSoFar >= target
                  ? `🎉 Challenge complete: ${freeSoFar} of ${target} no-spend days!`
                  : target - freeSoFar > daysLeft
                    ? `${target - freeSoFar} more needed but only ${daysLeft} days left — try again next month.`
                    : `${target - freeSoFar} more no-spend day${target - freeSoFar === 1 ? '' : 's'} to reach ${target}.`}
              </Text>
              <Pressable onPress={() => setNoSpendChallenge(null)} style={{ marginTop: 4 }}>
                <Text style={[typography.footnote, { color: colors.red }]}>End challenge</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6 }]}>Set a goal for this month:</Text>
              <ChipSelector
                options={[4, 8, 10, 15].map((n) => ({ id: String(n), label: `${n} days` }))}
                selectedId={null}
                onSelect={(id) => setNoSpendChallenge({ month: monthKey, target: Number(id) })}
              />
            </View>
          )}
        </Card>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>52-week savings challenge</Text>
        <Card>
          {!challenge52 ? (
            <>
              <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                Save 1 unit in week 1, 2 in week 2… up to 52 in week 52. Pick your unit:
              </Text>
              <ChipSelector
                options={[10, 20, 50, 100].map((u) => ({
                  id: String(u),
                  label: `${u} → ${formatMoney(toMinorUnits(((52 * 53) / 2) * u), currency)}`,
                }))}
                selectedId={null}
                onSelect={(id) => setChallenge52({ start: todayKey(), unit: toMinorUnits(Number(id)), done: [] })}
              />
            </>
          ) : (
            <>
              <Text style={[typography.title2, { color: colors.label }]}>{formatMoney(saved, currency)}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                of {formatMoney(goal, currency)} · week {currentWeek} — this week's amount is {formatMoney(currentWeek * unit, currency)}
              </Text>
              <View style={{ marginVertical: spacing.sm }}>
                <ProgressBar progress={saved / goal} color={colors.green} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => {
                  const isDone = done.includes(w);
                  const overdue = !isDone && w < currentWeek;
                  return (
                    <Pressable
                      key={w}
                      onPress={() => toggleWeek(w)}
                      style={{
                        width: 36,
                        height: 30,
                        margin: 2,
                        borderRadius: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDone ? colors.green : w === currentWeek ? colors.blue + '33' : overdue ? colors.orange + '33' : colors.tertiaryFill,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isDone ? '#fff' : colors.label }}>{w}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
                Tap a week once you've put its amount aside. Orange weeks are behind.
              </Text>
              <Button
                title="Restart challenge"
                variant="secondary"
                onPress={() =>
                  Alert.alert('Restart?', 'This clears your ticked weeks.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Restart', style: 'destructive', onPress: () => setChallenge52(null) },
                  ])
                }
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
