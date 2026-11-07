import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { MiniBars } from '../../ui/MiniBars';
import { ChipSelector } from '../../ui/ChipSelector';
import { TextField } from '../../ui/TextField';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { monthlyEquivalent } from '../../utils/spendingPlan';
import { habitMonthly, inflationLoss, projection } from '../../utils/wealth';
import type { useWealth } from './useWealth';

type W = ReturnType<typeof useWealth>;

const HABITS: { label: string; emoji: string; re: RegExp }[] = [
  { label: 'Food delivery', emoji: '🛵', re: /talabat|elmenus|breadfast|rabbit|instashop|noon food|uber\s*eats|طلبات/i },
  { label: 'Rides', emoji: '🚕', re: /uber(?!\s*eats)|careem|indrive|didi|swvl|bolt|halan/i },
  { label: 'Coffee out', emoji: '☕', re: /starbucks|costa|cilantro|dunkin|tim hortons|caribou|espresso lab|beano|coffee|كافيه/i },
  { label: 'Eating out', emoji: '🍔', re: /restaurant|mcdonald|kfc|burger|pizza|koshary|mo'?men|cook door|zooba|hardee|مطعم/i },
];

// Saving more: how much you keep each month, where it could come from, and
// what it grows into.
export function SaveTab({ w }: { w: W }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { savingsPct, setSavingsPct, expectedReturn, setExpectedReturn, inflationPct, setInflationPct } = useSettingsStore(
    useShallow((s) => ({ savingsPct: s.savingsPct, setSavingsPct: s.setSavingsPct, expectedReturn: s.expectedReturn, setExpectedReturn: s.setExpectedReturn, inflationPct: s.inflationPct, setInflationPct: s.setInflationPct }))
  );
  const recurring = useFinanceStore((s) => s.recurringRules);
  const [years, setYears] = useState('10');

  const subs = useMemo(
    () => recurring.filter((r) => r.is_subscription && r.is_active && !r.is_paused && r.type === 'expense').reduce((s, r) => s + w.toBase(monthlyEquivalent(r.amount, r.frequency, r.interval_count), r.currency), 0),
    [recurring, w]
  );
  const habits = useMemo(() => HABITS.map((h) => ({ ...h, monthly: habitMonthly(w.txs, h.re, w.recent3) })).filter((h) => h.monthly > 0).sort((a, b) => b.monthly - a.monthly), [w]);
  const topCats = useMemo(() => {
    const by = new Map<string, number>();
    for (const t of w.txs) {
      if (t.type !== 'expense' || !t.category) continue;
      const at = new Date(t.date).getTime();
      if (!w.recent3.some((p) => at >= p.start.getTime() && at < p.end.getTime())) continue;
      by.set(t.category, (by.get(t.category) ?? 0) + t.amount);
    }
    return [...by.entries()].map(([name, sum]) => ({ name, monthly: Math.round(sum / 3) })).sort((a, b) => b.monthly - a.monthly).slice(0, 3);
  }, [w]);

  const income = w.avgIncome || w.thisMonth.income;
  const goal = Math.round((income * savingsPct) / 100);
  const saving = Math.max(0, w.avgSaved);
  const proj = projection(goal || saving, Number(years) || 10, expectedReturn, 0, inflationPct);
  const bars = w.totals.map((m, k) => ({ key: String(k), label: m.start.toLocaleDateString(undefined, { month: 'short' }), value: Math.max(0, m.saved) }));

  return (
    <View>
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Saved per month, last 6 months</Text>
        <Text style={[typography.title1, { color: w.avgSaved < 0 ? colors.red : colors.label }]}>{w.fmt(w.avgSaved)}</Text>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
          {w.avgRate == null ? 'Log your income to see your savings rate.' : `${Math.round(w.avgRate * 100)}% of income on average${w.avgSaved < 0 ? ' — spending more than you earn' : ''}`}
        </Text>
        <MiniBars data={bars} color={colors.green} height={64} />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label }]}>Your saving goal</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
          {income ? `${savingsPct}% of ${w.fmt(income)} is ${w.fmt(goal)} a month.` : 'Set your income in Plan, or log your salary.'}
          {income && w.avgRate != null ? (w.avgRate * 100 >= savingsPct ? ' You’re hitting it 👏' : ` You’re at ${Math.max(0, Math.round(w.avgRate * 100))}% — ${w.fmt(Math.max(0, goal - w.avgSaved))} a month to go.`) : ''}
        </Text>
        <ChipSelector options={[10, 15, 20, 25, 30, 40].map((p) => ({ id: String(p), label: `${p}%` }))} selectedId={String(savingsPct)} onSelect={(id) => setSavingsPct(Number(id))} />
        <Pressable onPress={() => router.push('/money/payday')} style={{ marginTop: spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Move it on payday with the checklist →</Text>
        </Pressable>
      </Card>

      <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>Where you could save</Text>
      <Card style={{ marginBottom: spacing.md }}>
        {subs > 0 ? (
          <Pressable onPress={() => router.push('/money/subscriptions')} style={{ paddingVertical: 7 }}>
            <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>🔁 Subscriptions: {w.fmt(subs)} a month</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{w.fmt(subs * 12)} a year. Cancel one you don’t use and keep the difference.</Text>
          </Pressable>
        ) : null}
        {habits.map((h) => (
          <View key={h.label} style={{ paddingVertical: 7 }}>
            <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
              {h.emoji} {h.label}: {w.fmt(h.monthly)} a month
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Cutting a third saves {w.fmt(Math.round((h.monthly / 3) * 12))} a year.</Text>
          </View>
        ))}
        {topCats.map((c) => (
          <View key={c.name} style={{ paddingVertical: 7 }}>
            <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
              🏷️ {c.name}: {w.fmt(c.monthly)} a month
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Spending 10% less here saves {w.fmt(Math.round(c.monthly * 0.1 * 12))} a year.</Text>
          </View>
        ))}
        {!subs && !habits.length && !topCats.length ? <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Once you’ve logged a few weeks of spending, the easiest places to save show up here.</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
          {[
            ['No-spend challenges', '/money/challenges'],
            ['Round-ups', '/money/savings'],
            ['Budgets', '/money/budgets'],
          ].map(([l, r]) => (
            <Pressable key={r} onPress={() => router.push(r as never)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.tertiaryFill, marginRight: 6, marginTop: 6 }}>
              <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600' }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>What it grows into</Text>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="Years" keyboardType="number-pad" value={years} onChangeText={setYears} />
          </View>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="Return % / yr" keyboardType="decimal-pad" value={String(expectedReturn)} onChangeText={(t) => setExpectedReturn(Number(t) || 0)} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Inflation %" keyboardType="decimal-pad" value={inflationPct ? String(inflationPct) : ''} placeholder="0" onChangeText={(t) => setInflationPct(Number(t) || 0)} />
          </View>
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          Saving {w.fmt(goal || saving)} a month for {Number(years) || 10} years
        </Text>
        <Text style={[typography.title2, { color: colors.label }]}>{w.fmt(proj.nominal)}</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          You put in {w.fmt(proj.paidIn)}; growth adds {w.fmt(proj.nominal - proj.paidIn)}.
          {inflationPct > 0 ? ` In today’s money that’s about ${w.fmt(proj.real)}.` : ''}
        </Text>
        {inflationPct > 0 && w.backup.saved > 0 ? (
          <Text style={[typography.footnote, { color: colors.orange, marginTop: spacing.xs }]}>
            Cash sitting at 0% loses about {w.fmt(inflationLoss(w.backup.saved, inflationPct))} of buying power a year on your backup alone — keep backup money somewhere that earns.
          </Text>
        ) : null}
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>Returns are your own guess — nothing is guaranteed.</Text>
      </Card>
    </View>
  );
}
