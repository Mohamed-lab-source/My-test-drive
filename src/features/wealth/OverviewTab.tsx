import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressRing } from '../../ui/ProgressRing';
import type { useWealth } from './useWealth';

type W = ReturnType<typeof useWealth>;

// Where you stand: your next money step, and three numbers that matter.
export function OverviewTab({ w, onTab }: { w: W; onTab: (tab: number) => void }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { steps, current } = w.ladder;
  const next = steps[current];
  const months = Number.isFinite(w.backup.months) ? w.backup.months : w.backup.targetMonths;
  const rate = w.thisMonth.rate;

  const tile = (label: string, value: string, sub: string, tab: number, tint: string) => (
    <Pressable onPress={() => onTab(tab)} style={{ flex: 1, marginRight: tab < 3 ? spacing.sm : 0 }} accessibilityRole="button">
      <Card style={{ paddingVertical: 12 }}>
        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label}</Text>
        <Text style={[typography.title3, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[typography.caption2, { color: colors.tertiaryLabel }]} numberOfLines={2}>
          {sub}
        </Text>
      </Card>
    </Pressable>
  );

  return (
    <View>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ProgressRing progress={current / steps.length} size={58} strokeWidth={7} color={colors.green} label={`${current}/${steps.length}`} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{next ? 'Your next money step' : 'Every step done'}</Text>
            <Text style={[typography.headline, { color: colors.label }]}>{next ? next.title : 'You’re building wealth 🌱'}</Text>
            {next ? <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{next.detail}</Text> : null}
          </View>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          {steps.map((s, k) => (
            <Pressable key={s.id} onPress={() => router.push(s.route as never)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ width: 26, fontSize: 15 }}>{s.done ? '✅' : k === current ? '👉' : '⬜️'}</Text>
              <Text style={[typography.subhead, { color: s.done ? colors.secondaryLabel : colors.label, flex: 1, fontWeight: k === current ? '600' : '400' }]}>{s.title}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>
          The usual order: a small backup, no card debt, steady saving, a full backup, then investing.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
        {tile('Saved this month', rate == null ? '—' : `${Math.round(rate * 100)}%`, rate == null ? 'No income logged yet' : `${w.fmt(w.thisMonth.saved)} of income`, 1, rate != null && rate < 0 ? colors.red : colors.green)}
        {tile('Backup money', `${months >= 10 ? Math.round(months) : months.toFixed(1)} mo`, w.backup.monthly ? `of ${w.backup.targetMonths} months of spending` : 'Log spending to size it', 2, months >= w.backup.targetMonths ? colors.green : months >= 1 ? colors.orange : colors.red)}
        {tile('Invested', w.fmt(w.investedNow), w.investedIn ? `${w.investedNow >= w.investedIn ? '+' : ''}${w.fmt(w.investedNow - w.investedIn)} so far` : 'Nothing yet', 3, colors.blue)}
      </View>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>Three rules that work</Text>
        {[
          ['💰', 'Pay yourself first', 'Move savings out on payday, before spending — not what’s left at the end.'],
          ['🛟', 'Backup before investing', 'Investments can fall exactly when you need cash. Backup money never should.'],
          ['🧺', 'Spread it out, monthly', 'A little every month into a mix of gold, stocks/funds and safe savings beats guessing the right moment.'],
        ].map(([e, t, d]) => (
          <View key={t} style={{ flexDirection: 'row', paddingVertical: 6 }}>
            <Text style={{ fontSize: 18, width: 30 }}>{e}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{t}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{d}</Text>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}
