import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { usePersonalStore, ensurePersonalLoaded, type Item } from '../../../src/store/personalStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useQuickAddStore } from '../../../src/store/quickAddStore';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoneyWhole, toMinorUnits } from '../../../src/utils/money';
import { monthPeriod, periodLabel } from '../../../src/utils/period';
import { DEFAULT_PAYDAY_STEPS, periodKey, periodSalary, stepAmount, type PaydayMode, type PaydayStep } from '../../../src/utils/payday';
import * as Haptics from '../../../src/utils/haptics';

const MODES: { id: PaydayMode; label: string }[] = [
  { id: 'percent', label: '% of salary' },
  { id: 'fixed', label: 'Fixed amount' },
  { id: 'cards', label: 'All card balances' },
  { id: 'none', label: 'Just a reminder' },
];

// What to do the day your salary lands, ticked off once per pay period.
export default function PaydayScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const steps = usePersonalStore((s) => s.payday_step);
  const { add, update, remove } = usePersonalStore(useShallow((s) => ({ add: s.add, update: s.update, remove: s.remove })));
  const { currency, monthlyIncome } = useSettingsStore(useShallow((s) => ({ currency: s.currency, monthlyIncome: s.monthlyIncome })));
  const { accounts, transactions, categories, fxRates } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, transactions: s.transactions, categories: s.categories, fxRates: s.fxRates })));
  const quick = useQuickAddStore((s) => s.open);
  const [editing, setEditing] = useState<Item<PaydayStep> | 'new' | null>(null);

  useEffect(() => ensurePersonalLoaded(), []);

  const period = monthPeriod(new Date());
  const key = periodKey(period.start);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const salary = periodSalary(
    transactions
      .filter((t) => t.type === 'income')
      .map((t) => ({ amount: convertToBase(t.amount, t.currency, currency, fxRates), date: t.date, note: t.note, category: t.category_id ? catName.get(t.category_id) ?? null : null })),
    period.start,
    monthlyIncome
  );
  const cards = accounts.filter((a) => a.type === 'credit' && !a.is_archived && a.balance < 0);
  const cardsOwed = cards.reduce((s, a) => s + convertToBase(-a.balance, a.currency, currency, fxRates), 0);
  const payFrom = accounts.find((a) => a.type === 'bank' && !a.is_archived)?.id;
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const done = sorted.filter((s) => s.doneFor === key).length;
  const committed = sorted.reduce((s, st) => s + stepAmount(st, salary.amount, cardsOwed), 0);

  const toggle = async (st: Item<PaydayStep>) => {
    const nowDone = st.doneFor !== key;
    await update('payday_step', st.id, { ...st, doneFor: nowDone ? key : null });
    if (nowDone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (done + 1 === sorted.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const move = async (st: Item<PaydayStep>, dir: -1 | 1) => {
    const i = sorted.findIndex((x) => x.id === st.id);
    const other = sorted[i + dir];
    if (!other) return;
    await update('payday_step', st.id, { ...st, order: other.order });
    await update('payday_step', other.id, { ...other, order: st.order });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Payday checklist"
        right={
          <Pressable onPress={() => setEditing('new')} hitSlop={8} accessibilityLabel="Add a step">
            <Text style={[typography.body, { color: colors.blue }]}>Add</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>This pay period · {periodLabel(period)}</Text>
          <Text style={[typography.title1, { color: colors.label }]}>{formatMoneyWhole(salary.amount, currency)}</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
            {salary.found ? 'Salary found in your income' : salary.amount ? 'From your monthly income in Plan (no salary logged yet)' : 'Log your salary as income, or set your monthly income in Plan'}
          </Text>
          {sorted.length ? (
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar progress={done / sorted.length} color={colors.green} />
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                {done === sorted.length ? '✅ All done for this payday. Barak Allahu feek!' : `${done} of ${sorted.length} done`}
                {salary.amount ? ` · ${formatMoneyWhole(Math.max(0, salary.amount - committed), currency)} left after the list` : ''}
              </Text>
            </View>
          ) : null}
        </Card>

        {sorted.length === 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Start with the usual steps?</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginVertical: 4 }]}>
              Pay off the cards, save 10%, sadaqah 2.5%, the gam'eya, family and bills. Change any of them after.
            </Text>
            <Button
              title="Add the suggested steps"
              onPress={async () => {
                for (const st of DEFAULT_PAYDAY_STEPS) await add('payday_step', st);
              }}
            />
          </Card>
        ) : null}

        {sorted.map((st, i) => {
          const amount = stepAmount(st, salary.amount, cardsOwed);
          const isDone = st.doneFor === key;
          return (
            <Card key={st.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPress={() => toggle(st)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} style={{ marginRight: spacing.sm }}>
                  <Text style={{ fontSize: 24 }}>{isDone ? '✅' : '⬜️'}</Text>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => (st.route ? router.push(st.route as never) : toggle(st))} onLongPress={() => setEditing(st)}>
                  <Text style={[typography.headline, { color: isDone ? colors.secondaryLabel : colors.label, textDecorationLine: isDone ? 'line-through' : 'none' }]}>
                    {st.emoji} {st.title}
                  </Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                    {st.mode === 'percent'
                      ? `${st.value}% · ${formatMoneyWhole(amount, currency)}`
                      : st.mode === 'fixed'
                        ? st.value
                          ? formatMoneyWhole(amount, currency)
                          : 'Tap and hold to set an amount'
                        : st.mode === 'cards'
                          ? cards.length
                            ? `${formatMoneyWhole(amount, currency)} on ${cards.length} card${cards.length === 1 ? '' : 's'}`
                            : 'Nothing owed on your cards 🎉'
                          : st.route
                            ? 'Tap to open'
                            : 'Reminder'}
                  </Text>
                </Pressable>
                <View>
                  {i > 0 ? (
                    <Pressable onPress={() => move(st, -1)} hitSlop={6} accessibilityLabel="Move up" style={{ padding: 3 }}>
                      <Text style={{ color: colors.blue }}>▲</Text>
                    </Pressable>
                  ) : null}
                  {i < sorted.length - 1 ? (
                    <Pressable onPress={() => move(st, 1)} hitSlop={6} accessibilityLabel="Move down" style={{ padding: 3 }}>
                      <Text style={{ color: colors.blue }}>▼</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {st.mode === 'cards' && cards.length && !isDone ? (
                <View style={{ marginTop: spacing.xs, marginLeft: 36 }}>
                  {cards.map((c) => (
                    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                      <Text style={[typography.subhead, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                        {c.name} · {formatMoneyWhole(-c.balance, c.currency)}
                      </Text>
                      {payFrom ? (
                        <Pressable onPress={() => quick('transfer', payFrom, { toAccountId: c.id, amount: -c.balance })} hitSlop={6}>
                          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Pay</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })}
        {sorted.length ? (
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.xs }]}>
            Tap and hold a step to edit it. Ticks reset by themselves when your next salary arrives.
          </Text>
        ) : null}
      </ScrollView>
      <StepSheet
        editing={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (editing && editing !== 'new') await update('payday_step', editing.id, { ...editing, ...data });
          else await add('payday_step', { ...data, order: sorted.length ? Math.max(...sorted.map((s) => s.order)) + 1 : 0 });
          setEditing(null);
        }}
        onDelete={
          editing && editing !== 'new'
            ? () =>
                Alert.alert(`Delete “${editing.title}”?`, undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await remove('payday_step', editing.id);
                      setEditing(null);
                    },
                  },
                ])
            : undefined
        }
      />
    </View>
  );
}

function StepSheet({
  editing,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Item<PaydayStep> | 'new' | null;
  currency: string;
  onClose: () => void;
  onSave: (s: PaydayStep) => void;
  onDelete?: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const s = editing && editing !== 'new' ? editing : null;
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [mode, setMode] = useState<PaydayMode>('none');
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!editing) return;
    setTitle(s?.title ?? '');
    setEmoji(s?.emoji ?? '✅');
    setMode(s?.mode ?? 'none');
    setValue(s ? String(s.mode === 'fixed' ? s.value / 100 : s.value || '') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  return (
    <Sheet visible={!!editing} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{s ? 'Edit step' : 'New step'}</Text>
        <TextField label="Step" placeholder="e.g. Send money to Mama" value={title} onChangeText={setTitle} />
        <TextField label="Emoji" value={emoji} onChangeText={(t) => setEmoji(t.trim().slice(0, 4) || '✅')} />
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: 4 }]}>Amount</Text>
        <ChipSelector options={MODES.map((m) => ({ id: m.id, label: m.label }))} selectedId={mode} onSelect={(id) => setMode(id as PaydayMode)} />
        <View style={{ height: spacing.sm }} />
        {mode === 'percent' || mode === 'fixed' ? (
          <TextField label={mode === 'percent' ? 'Percent of salary' : `Amount (${currency})`} keyboardType="decimal-pad" value={value} onChangeText={setValue} />
        ) : null}
        <Button
          title="Save"
          disabled={!title.trim()}
          onPress={() =>
            onSave({
              title: title.trim(),
              emoji,
              mode,
              value: mode === 'fixed' ? toMinorUnits(Number(value) || 0) : mode === 'percent' ? Number(value) || 0 : 0,
              doneFor: s?.doneFor ?? null,
              order: s?.order ?? 0,
              route: s?.route ?? null,
            })
          }
        />
        {onDelete ? <Button title="Delete step" variant="secondary" onPress={onDelete} style={{ marginTop: spacing.sm }} /> : null}
      </ScrollView>
    </Sheet>
  );
}
