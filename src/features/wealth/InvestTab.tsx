import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { TextField } from '../../ui/TextField';
import { useSettingsStore } from '../../store/settingsStore';
import { usePersonalStore, type Item } from '../../store/personalStore';
import { formatDateKey } from '../../utils/date';
import { toMinorUnits } from '../../utils/money';
import { BUCKETS, kindInfo, maturingSoon, rebalanceHints, RISK_QUESTIONS, riskProfile, splitMonthly, TARGET_MIX, type Bucket, type Holding } from '../../utils/wealth';
import { HoldingSheet } from './HoldingSheet';
import type { useWealth } from './useWealth';

type W = ReturnType<typeof useWealth>;

const PROFILE_TEXT = {
  careful: { label: 'Careful', emoji: '🛡️', text: 'Protect what you have first; slow, steady growth.' },
  balanced: { label: 'Balanced', emoji: '⚖️', text: 'Growth with a solid safe base — the usual middle road.' },
  growth: { label: 'Growth', emoji: '🚀', text: 'Long horizon and calm in a fall; more in stocks and funds.' },
};

const BUCKET_COLOR: Record<Bucket, 'blue' | 'yellow' | 'green' | 'teal'> = { safe: 'blue', gold: 'yellow', stocks: 'green', fx: 'teal' };

// Investing right: your style, a mix to aim for, what you hold, and where
// this month's money should go.
export function InvestTab({ w }: { w: W }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const s = useSettingsStore(
    useShallow((x) => ({
      riskAnswers: x.riskAnswers,
      setRiskAnswers: x.setRiskAnswers,
      avoidInterest: x.avoidInterest,
      setAvoidInterest: x.setAvoidInterest,
      monthlyInvest: x.monthlyInvest,
      setMonthlyInvest: x.setMonthlyInvest,
      gold24: x.goldPricePerGram,
      setGold24: x.setGoldPricePerGram,
    }))
  );
  const { add, update, remove } = usePersonalStore(useShallow((x) => ({ add: x.add, update: x.update, remove: x.remove })));
  const [quiz, setQuiz] = useState(false);
  const [editing, setEditing] = useState<Partial<Holding> | Item<Holding> | null>(null);
  const [goldInput, setGoldInput] = useState(s.gold24 ? String(s.gold24) : '');
  const [monthlyInput, setMonthlyInput] = useState(s.monthlyInvest ? String(s.monthlyInvest / 100) : '');
  const tint = (b: Bucket) => (colors as unknown as Record<string, string>)[BUCKET_COLOR[b]];

  const notReady = [w.backup.months < 1 ? 'build at least one month of backup money' : null, w.cardDebt > 0 ? `clear the ${w.fmt(w.cardDebt)} on your cards` : null].filter(Boolean);
  const target = w.target;
  const split = target && s.monthlyInvest > 0 ? splitMonthly(s.monthlyInvest, w.alloc.by, target) : null;
  const hints = target ? rebalanceHints(w.alloc.pct, target, w.alloc.total) : [];
  const soon = maturingSoon(w.holdings, w.now, 45);
  const hasGold = w.holdings.some((h) => h.kind === 'gold');
  const suggestedMonthly = Math.max(0, Math.round(w.avgSaved * (w.backup.level === 'full' ? 0.7 : 0.3)));

  return (
    <View>
      {notReady.length ? (
        <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.orange + '66' }}>
          <Text style={[typography.headline, { color: colors.label }]}>Before investing more</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
            Try to {notReady.join(' and ')} first. Investments can drop just when you need cash, and card interest outruns what investing earns.
          </Text>
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.md }}>
        {w.profile ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 26, marginRight: spacing.sm }}>{PROFILE_TEXT[w.profile].emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Your investing style</Text>
                <Text style={[typography.headline, { color: colors.label }]}>{PROFILE_TEXT[w.profile].label}</Text>
              </View>
              <Pressable onPress={() => setQuiz(true)} hitSlop={8}>
                <Text style={[typography.subhead, { color: colors.blue }]}>Retake</Text>
              </Pressable>
            </View>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>{PROFILE_TEXT[w.profile].text}</Text>
            <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: spacing.sm }}>
              {BUCKETS.map((b) => (
                <View key={b.id} style={{ flex: TARGET_MIX[w.profile!][b.id], backgroundColor: tint(b.id) }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {BUCKETS.map((b) => (
                <Text key={b.id} style={[typography.caption1, { color: colors.secondaryLabel, marginRight: spacing.sm }]}>
                  {b.emoji} {b.label} {TARGET_MIX[w.profile!][b.id]}%
                </Text>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[typography.headline, { color: colors.label }]}>Find your investing style</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginVertical: 4 }]}>Four quick questions give you a mix to aim for across safe savings, gold, stocks/funds and foreign currency.</Text>
            <Button title="Start" onPress={() => setQuiz(true)} />
          </>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.label }]}>Avoid interest (riba)</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Points you to sukuk, Islamic savings and Sharia-screened stocks, and flags interest-based products.</Text>
          </View>
          <Switch value={s.avoidInterest} onValueChange={s.setAvoidInterest} />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label }]}>Invest every month</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
          {suggestedMonthly > 0 ? `About ${w.fmt(suggestedMonthly)} fits what you save now${w.backup.level === 'full' ? '' : ' while you keep filling your backup'}.` : 'Start with any amount you can keep up — consistency matters more than size.'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label={`Each month (${w.currency})`} keyboardType="decimal-pad" value={monthlyInput} onChangeText={setMonthlyInput} onBlur={() => s.setMonthlyInvest(toMinorUnits(Number(monthlyInput) || 0))} />
          </View>
          {suggestedMonthly > 0 && !monthlyInput ? (
            <Button
              title="Use it"
              variant="secondary"
              onPress={() => {
                setMonthlyInput(String(Math.round(suggestedMonthly / 100)));
                s.setMonthlyInvest(Math.round(suggestedMonthly / 100) * 100);
              }}
              style={{ marginBottom: spacing.md }}
            />
          ) : null}
        </View>
        {split ? (
          <>
            <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>This month, put it into</Text>
            {BUCKETS.filter((b) => split[b.id] > 0).map((b) => (
              <View key={b.id} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                <Text style={[typography.subhead, { color: colors.label, flex: 1 }]}>
                  {b.emoji} {b.label}
                </Text>
                <Text style={[typography.subhead, { color: tint(b.id), fontWeight: '700' }]}>{w.fmt(split[b.id])}</Text>
              </View>
            ))}
            <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>Weighted toward whatever is furthest below your mix, so you rebalance without selling.</Text>
          </>
        ) : !w.profile && s.monthlyInvest > 0 ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Find your style above to see how to split it.</Text>
        ) : null}
      </Card>

      <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>What you hold</Text>
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.title2, { color: colors.label }]}>{w.fmt(w.investedNow)}</Text>
        {w.investedIn ? (
          <Text style={[typography.footnote, { color: w.investedNow >= w.investedIn ? colors.green : colors.red }]}>
            {w.investedNow >= w.investedIn ? '+' : ''}
            {w.fmt(w.investedNow - w.investedIn)} ({w.investedIn ? (((w.investedNow - w.investedIn) / w.investedIn) * 100).toFixed(1) : '0'}%) on {w.fmt(w.investedIn)} put in
          </Text>
        ) : null}
        {w.alloc.total > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            {BUCKETS.map((b) => (
              <View key={b.id} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={[typography.caption1, { color: colors.label, flex: 1 }]}>
                    {b.emoji} {b.label}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                    {Math.round(w.alloc.pct[b.id])}%{target ? ` · aim ${target[b.id]}%` : ''}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.tertiaryFill, overflow: 'hidden', marginTop: 2 }}>
                  <View style={{ width: `${Math.min(100, w.alloc.pct[b.id])}%`, height: 6, backgroundColor: tint(b.id) }} />
                </View>
              </View>
            ))}
            {hints.length ? (
              <Text style={[typography.caption1, { color: colors.orange }]}>
                {hints
                  .slice(0, 2)
                  .map((h) => `${BUCKETS.find((b) => b.id === h.bucket)!.label} is ${Math.abs(Math.round(h.diff))} points ${h.diff > 0 ? 'above' : 'below'} your mix`)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {w.holdings.length === 0 ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>Add the gold, certificates, funds, stocks or dollars you already own to see your real mix.</Text>
        ) : (
          w.valued.map((v) => {
            const info = kindInfo(v.h.kind);
            const gain = v.value - w.toBase(v.h.invested, v.h.currency);
            return (
              <Pressable key={v.h.id} onPress={() => setEditing(v.h)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.separator, marginTop: 4 }}>
                <Text style={{ fontSize: 20, width: 32 }}>{info.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
                    {v.h.name}
                    {s.avoidInterest && info.interest ? ' ⚠️' : ''}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                    {info.label}
                    {v.h.ratePct ? ` · ${v.h.ratePct}%` : ''}
                    {v.h.maturity ? ` · until ${formatDateKey(v.h.maturity)}` : ''}
                    {w.backupHoldings.some((b) => b.h.id === v.h.id) ? ' · backup money' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{w.fmt(v.value)}</Text>
                  {gain !== 0 ? <Text style={[typography.caption2, { color: gain > 0 ? colors.green : colors.red }]}>{gain > 0 ? '+' : ''}{w.fmt(gain)}</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}
        <Button title="Add an investment" variant="secondary" onPress={() => setEditing({ kind: 'gold' })} style={{ marginTop: spacing.sm }} />
      </Card>

      {hasGold ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Today’s gold price</Text>
          <TextField
            label={`24k per gram (${w.currency})`}
            keyboardType="decimal-pad"
            value={goldInput}
            onChangeText={setGoldInput}
            onBlur={() => s.setGold24(Number(goldInput) || 0)}
          />
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -4 }]}>
            {s.gold24 ? `21k ≈ ${w.fmt(Math.round(s.gold24 * (21 / 24) * 100))} · 18k ≈ ${w.fmt(Math.round(s.gold24 * (18 / 24) * 100))} a gram. Also used for zakat.` : 'Set it to value your gold (also used for zakat).'}
          </Text>
        </Card>
      ) : null}

      {soon.length ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Maturing soon</Text>
          {soon.map(({ h, days }) => (
            <Text key={h.id} style={[typography.subhead, { color: colors.label, paddingVertical: 4 }]}>
              📜 {h.name} · {days === 0 ? 'today' : `in ${days} days`} — decide where it goes next
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>Investing right</Text>
        {[
          ['🧺', 'Don’t put it all in one place', 'Gold, property and dollars all had years when they fell. A mix smooths the ride.'],
          ['📅', 'Same amount, every month', 'Buying monthly means you buy more when prices are low, without having to guess.'],
          ['⏳', 'Stocks are for 5+ years', 'Money needed sooner belongs in safe savings, not shares.'],
          ['🚩', 'Walk away from guaranteed high returns', 'Promises of fixed big profits, crypto “doubling” or schemes paying old members with new money are how people lose savings.'],
          ['🧾', 'Know what you own and pay zakat on it', 'Gold, cash, shares and trade goods are zakatable once a year has passed.'],
        ].map(([e, t, d]) => (
          <View key={t} style={{ flexDirection: 'row', paddingVertical: 6 }}>
            <Text style={{ fontSize: 17, width: 30 }}>{e}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{t}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{d}</Text>
            </View>
          </View>
        ))}
        <Pressable onPress={() => router.push('/money/zakat')}>
          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600', marginTop: 4 }]}>Work out zakat →</Text>
        </Pressable>
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.sm }]}>
          General guidance, not financial advice or a religious ruling. For big decisions, talk to a licensed adviser and ask a scholar you trust.
        </Text>
      </Card>

      <RiskQuiz
        visible={quiz}
        initial={s.riskAnswers}
        onClose={() => setQuiz(false)}
        onDone={(a) => {
          s.setRiskAnswers(a);
          setQuiz(false);
        }}
      />
      <HoldingSheet
        editing={editing}
        currency={w.currency}
        avoidInterest={s.avoidInterest}
        onClose={() => setEditing(null)}
        onSave={async (h) => {
          if (editing && 'id' in editing && editing.id) await update('holding', editing.id, { ...(editing as Item<Holding>), ...h });
          else await add('holding', h);
          setEditing(null);
        }}
        onDelete={
          editing && 'id' in editing && editing.id
            ? () =>
                Alert.alert(`Delete ${editing.name}?`, undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await remove('holding', (editing as Item<Holding>).id);
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

function RiskQuiz({ visible, initial, onClose, onDone }: { visible: boolean; initial: number[] | null; onClose: () => void; onDone: (a: number[]) => void }) {
  const { colors, typography, spacing } = useTheme();
  const [answers, setAnswers] = useState<(number | null)[]>(initial ?? RISK_QUESTIONS.map(() => null));
  const complete = answers.every((a) => a != null);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.sm }]}>Your investing style</Text>
        {RISK_QUESTIONS.map((q, qi) => (
          <View key={q.q} style={{ marginBottom: spacing.sm }}>
            <Text style={[typography.subhead, { color: colors.label, fontWeight: '600', marginBottom: 4 }]}>{q.q}</Text>
            {q.options.map((o, oi) => (
              <Pressable
                key={o}
                onPress={() => setAnswers((prev) => prev.map((x, k) => (k === qi ? oi : x)))}
                style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4, backgroundColor: answers[qi] === oi ? colors.blue : colors.tertiaryFill }}
              >
                <Text style={[typography.subhead, { color: answers[qi] === oi ? '#FFFFFF' : colors.label }]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Button
          title={complete ? `See my style: ${PROFILE_TEXT[riskProfile(answers as number[])].label}` : 'Answer all four'}
          disabled={!complete}
          onPress={() => onDone(answers as number[])}
        />
      </View>
    </Sheet>
  );
}
