import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Button } from '../../../src/ui/Button';
import { TextField } from '../../../src/ui/TextField';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { Sheet } from '../../../src/ui/Sheet';
import { EmptyState } from '../../../src/ui/EmptyState';
import { AmountPromptSheet } from '../../../src/features/money/AmountPromptSheet';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useQuickAddStore } from '../../../src/store/quickAddStore';
import { usePersonalStore, ensurePersonalLoaded } from '../../../src/store/personalStore';
import { useUndoStore } from '../../../src/store/undoStore';
import { useDebtPlan, type PlanDebt } from '../../../src/features/debt/useDebtPlan';
import { minimumFor, monthFromNow } from '../../../src/utils/debtFree';
import { toMinorUnits } from '../../../src/utils/money';
import { formatDateKey } from '../../../src/utils/date';
import * as Haptics from '../../../src/utils/haptics';

const monthName = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

// Becoming debt-free: all your cards and loans in one plan — what to pay on
// each this month, the order to clear them, and when you'll be done.
export default function DebtPlanScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const p = useDebtPlan();
  const { setDebtPlan, setDebtTerms, terms } = useSettingsStore(useShallow((s) => ({ setDebtPlan: s.setDebtPlan, setDebtTerms: s.setDebtTerms, terms: s.debtTerms })));
  const { accounts, payDebt } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, payDebt: s.payDebt })));
  const quick = useQuickAddStore((s) => s.open);
  const addStep = usePersonalStore((s) => s.add);
  const steps = usePersonalStore((s) => s.payday_step);
  const show = useUndoStore((s) => s.show);
  const [budgetInput, setBudgetInput] = useState('');
  const [paying, setPaying] = useState<PlanDebt | null>(null);
  const [termsFor, setTermsFor] = useState<PlanDebt | null>(null);

  useEffect(() => ensurePersonalLoaded(), []);
  useEffect(() => {
    setBudgetInput(p.plan ? String(Math.round(p.plan.budget / 100)) : p.minimums ? String(Math.ceil((p.minimums * 1.3) / 10000) * 100) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!p.plan]);

  const now = new Date();
  const save = (budget: number, strategy: 'avalanche' | 'snowball') =>
    setDebtPlan({ budget, strategy, startTotal: p.plan?.startTotal ?? p.total, startedAt: p.plan?.startedAt ?? new Date().toISOString() });
  const payFrom = accounts.find((a) => a.type === 'bank' && !a.is_archived)?.id ?? accounts.find((a) => a.type !== 'credit' && !a.is_archived)?.id;
  const order = [...p.list].sort((a, b) => (p.result.perDebt[a.id]?.month || 999) - (p.result.perDebt[b.id]?.month || 999));
  const saved = p.minOnly.feasible ? p.minOnly.totalInterest - p.result.totalInterest : null;
  const otherBetter = p.other.totalInterest < p.result.totalInterest - 100;
  const missing = p.list.filter((d) => d.missingRate);

  if (!p.list.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Debt-free plan" />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <EmptyState icon="checkmark.circle.fill" title={p.plan ? 'Debt-free! 🎉' : 'No debts'} message={p.plan ? 'Every card and loan is cleared. Alhamdulillah — now keep cards paid in full each month.' : 'Card balances you owe and money you owe people (from Debts) show up here with a plan to clear them.'} />
          <Button title="Add money I owe" variant="secondary" onPress={() => router.push('/money/debts')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Debt-free plan" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>You owe</Text>
          <Text style={[typography.title1, { color: colors.label }]}>{p.fmt(p.total)}</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            {p.list.filter((d) => d.kind === 'card').length} card{p.list.filter((d) => d.kind === 'card').length === 1 ? '' : 's'} · {p.list.filter((d) => d.kind === 'loan').length} loan
            {p.list.filter((d) => d.kind === 'loan').length === 1 ? '' : 's'}
            {p.paidThisMonth ? ` · ${p.fmt(p.paidThisMonth)} paid to cards this month` : ''}
          </Text>
          {p.plan ? (
            <>
              <View style={{ marginVertical: spacing.xs }}>
                <ProgressBar progress={p.plan.startTotal ? p.paidOff / p.plan.startTotal : 0} color={colors.green} />
              </View>
              <Text style={[typography.caption1, { color: colors.green, fontWeight: '600' }]}>
                {p.fmt(p.paidOff)} paid off since {formatDateKey(p.plan.startedAt.slice(0, 10))}
              </Text>
            </>
          ) : null}
          <View style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: 12, backgroundColor: p.result.feasible ? colors.green + '18' : colors.red + '18' }}>
            {p.result.feasible ? (
              <>
                <Text style={[typography.headline, { color: colors.label }]}>Debt-free by {monthName(monthFromNow(now, p.result.months - 1))}</Text>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  In {p.result.months} month{p.result.months === 1 ? '' : 's'} · {p.fmt(p.result.totalInterest)} interest on the way
                  {saved && saved > 0 ? ` · ${p.fmt(saved)} less than paying minimums` : ''}
                </Text>
              </>
            ) : (
              <Text style={[typography.headline, { color: colors.red }]}>At {p.fmt(p.budget)} a month the interest keeps up with you — pay more each month to get out.</Text>
            )}
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Each month toward debt</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
            Minimums add up to {p.fmt(p.minimums)}. Everything above that speeds you up.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <TextField label={`Monthly (${p.currency})`} keyboardType="decimal-pad" value={budgetInput} onChangeText={setBudgetInput} />
            </View>
            <Button
              title={p.plan ? 'Update' : 'Start plan'}
              onPress={() => {
                save(Math.max(p.minimums, toMinorUnits(Number(budgetInput) || 0)), p.strategy);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
              style={{ marginBottom: spacing.md }}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[1, 1.25, 1.5, 2].map((k) => {
              const amt = Math.ceil((p.minimums * k) / 10000) * 10000;
              return (
                <Pressable key={k} onPress={() => setBudgetInput(String(amt / 100))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.tertiaryFill, marginRight: 6, marginBottom: 6 }}>
                  <Text style={[typography.footnote, { color: colors.label }]}>{k === 1 ? 'Minimums' : `+${Math.round((k - 1) * 100)}%`} · {p.fmt(amt)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[typography.subhead, { color: colors.label, fontWeight: '600', marginTop: spacing.sm, marginBottom: 4 }]}>Which debt first?</Text>
          <SegmentedControl options={['Highest interest', 'Smallest balance']} selectedIndex={p.strategy === 'avalanche' ? 0 : 1} onChange={(i) => save(p.plan?.budget ?? p.budget, i === 0 ? 'avalanche' : 'snowball')} />
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
            {p.strategy === 'avalanche' ? 'Saves the most interest.' : 'Clears small debts fast — the quick wins keep you going.'}
            {otherBetter ? ` The other order would save ${p.fmt(p.result.totalInterest - p.other.totalInterest)}.` : p.other.totalInterest > p.result.totalInterest + 100 ? ` ${p.fmt(p.other.totalInterest - p.result.totalInterest)} cheaper than the other order.` : ''}
          </Text>
          {p.plan && !steps.some((s) => /debt plan/i.test(s.title)) ? (
            <Pressable
              onPress={async () => {
                await addStep('payday_step', { title: 'Debt plan payment', emoji: '🎯', mode: 'fixed', value: p.budget, doneFor: null, order: -1, route: '/money/debt-plan' });
                show('Added to your payday checklist');
              }}
              style={{ marginTop: spacing.sm }}
            >
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add to my payday checklist →</Text>
            </Pressable>
          ) : null}
        </Card>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>This month, pay</Text>
        <Card style={{ marginBottom: spacing.md, paddingVertical: 4 }}>
          {order.map((d, k) => {
            const pay = p.result.firstMonth[d.id] ?? 0;
            const min = minimumFor(d, d.balance);
            const focus = p.result.focusId === d.id;
            const doneMonth = p.result.perDebt[d.id]?.month;
            return (
              <View key={d.id} style={{ paddingVertical: 10, borderBottomWidth: k === order.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, width: 30 }}>{focus ? '🎯' : d.kind === 'card' ? '💳' : '🤝'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={2}>
                      {p.fmt(d.balance)} left
                      {d.apr ? ` · ${d.apr}% a year` : d.kind === 'card' ? ' · rate not set' : ''}
                      {min ? ` · min ${p.fmt(min)}` : ''}
                      {d.dueDay ? ` · due on the ${d.dueDay}` : d.dueDate ? ` · due ${formatDateKey(d.dueDate)}` : ''}
                    </Text>
                    {doneMonth ? <Text style={[typography.caption1, { color: colors.green }]}>Cleared by {monthName(monthFromNow(now, doneMonth - 1))}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[typography.headline, { color: focus ? colors.blue : colors.label }]}>{p.fmt(pay)}</Text>
                    <Pressable
                      onPress={() => {
                        if (d.accountId && payFrom) quick('transfer', payFrom, { toAccountId: d.accountId, amount: pay });
                        else setPaying(d);
                      }}
                      hitSlop={6}
                    >
                      <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Pay</Text>
                    </Pressable>
                  </View>
                </View>
                {focus ? <Text style={[typography.caption1, { color: colors.blue, marginLeft: 30, marginTop: 2 }]}>Focus: everything above the minimums goes here until it’s gone.</Text> : null}
                {d.missingRate || d.kind === 'loan' ? (
                  <Pressable
                    onPress={() => (d.accountId ? router.push(`/money/account/${d.accountId}`) : setTermsFor(d))}
                    style={{ marginLeft: 30, marginTop: 2 }}
                  >
                    <Text style={[typography.caption1, { color: colors.orange }]}>
                      {d.accountId ? 'Add the card’s interest rate for accurate numbers →' : `Interest ${d.apr}% · monthly ${d.fixedMin ? p.fmt(d.fixedMin) : 'none'} — change →`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Card>

        {p.minOnly.totalInterest > 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Why not just the minimum?</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Minimums only</Text>
                <Text style={[typography.title3, { color: colors.red }]}>{p.minOnly.feasible ? `${Math.ceil(p.minOnly.months / 12)} yrs` : 'Never'}</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{p.fmt(p.minOnly.totalInterest)} interest</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Your plan</Text>
                <Text style={[typography.title3, { color: colors.green }]}>{p.result.feasible ? `${p.result.months} mo` : '—'}</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{p.fmt(p.result.totalInterest)} interest</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {missing.length ? (
          <Text style={[typography.caption1, { color: colors.orange, marginBottom: spacing.md }]}>
            {missing.length} card{missing.length === 1 ? ' has' : 's have'} no interest rate set, so the interest shown is lower than it will really be.
          </Text>
        ) : null}

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>Getting out faster</Text>
          {[
            ['✂️', 'Stop adding to it', 'Pay with debit or cash while you clear the cards — new purchases undo the plan.'],
            ['📅', 'Pay before the due date', 'Late fees and extra interest add up fast. Paying on payday is easiest.'],
            ['🎁', 'Send windfalls to the focus debt', 'Bonus, gam’eya payout, Eidiya you receive, a refund — every lump sum shortens the plan.'],
            ['📞', 'Ask the bank', 'A lower rate or moving a balance to an instalment plan at a lower cost can help — compare the real total first.'],
            ['🏧', 'No cash withdrawals on a credit card', 'They charge a fee and interest from day one.'],
            ['🎉', 'Celebrate each payoff', 'Then roll its payment straight into the next one.'],
          ].map(([e, t, d]) => (
            <View key={t} style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <Text style={{ fontSize: 17, width: 30 }}>{e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{t}</Text>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{d}</Text>
              </View>
            </View>
          ))}
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>
            Estimates from your balances, rates and minimums. Your bank's statement is the final word.
          </Text>
        </Card>
      </ScrollView>

      <AmountPromptSheet
        visible={!!paying}
        onClose={() => setPaying(null)}
        title={paying ? `Pay ${paying.name}` : ''}
        confirmLabel="Record payment"
        onSubmit={async (amount, note) => {
          if (paying?.debtId) await payDebt(paying.debtId, amount, note);
          setPaying(null);
        }}
      />
      <LoanTermsSheet
        debt={termsFor}
        initial={termsFor?.debtId ? terms[termsFor.debtId] : undefined}
        currency={p.currency}
        onClose={() => setTermsFor(null)}
        onSave={(apr, min) => {
          if (termsFor?.debtId) setDebtTerms(termsFor.debtId, { apr, min });
          setTermsFor(null);
        }}
      />
    </View>
  );
}

function LoanTermsSheet({
  debt,
  initial,
  currency,
  onClose,
  onSave,
}: {
  debt: PlanDebt | null;
  initial?: { apr: number; min: number };
  currency: string;
  onClose: () => void;
  onSave: (apr: number, min: number) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const [apr, setApr] = useState('');
  const [min, setMin] = useState('');
  useEffect(() => {
    if (!debt) return;
    setApr(initial?.apr ? String(initial.apr) : '');
    setMin(initial?.min ? String(initial.min / 100) : '');
  }, [debt, initial]);
  return (
    <Sheet visible={!!debt} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.sm }]}>{debt?.name}</Text>
        <TextField label="Interest % a year" placeholder="0 for a loan from family or friends" keyboardType="decimal-pad" value={apr} onChangeText={setApr} />
        <TextField label={`Monthly instalment (${currency})`} placeholder="Leave empty if there isn't one" keyboardType="decimal-pad" value={min} onChangeText={setMin} />
        <Button title="Save" onPress={() => onSave(Number(apr) || 0, toMinorUnits(Number(min) || 0))} />
      </View>
    </Sheet>
  );
}
