import React, { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuickAddStore } from '../../../src/store/quickAddStore';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Appear } from '../../../src/ui/Appear';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney, formatMoneyWhole } from '../../../src/utils/money';
import { statementPeriods } from '../../../src/utils/statement';
import { DEFAULT_MIN_PCT, minimumPayment, monthlyInterest, payoffMonths, utilizationTone } from '../../../src/utils/cardMath';
import type { Account, Transaction } from '../../../src/db/types';
import { currentMonthStart, dayOfPeriod, daysIn as periodDays, monthPeriod } from '../../../src/utils/period';

const DAY = 86400000;

// Every card and account with its limits: credit used and available,
// minimum payment and due date, interest if carried over, this month's
// spending against your own limit, and totals across all cards.
export default function CardsAndAccountsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { accounts, fxRates } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, fxRates: s.fxRates })));
  const currency = useSettingsStore((s) => s.currency);
  const [txs, setTxs] = useState<Transaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      repo.listTransactionsInRange(new Date(now.getTime() - 62 * DAY).toISOString(), new Date(now.getTime() + DAY).toISOString()).then(setTxs);
    }, [accounts])
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = currentMonthStart(now).getTime();
  const daysIn = periodDays(monthPeriod(now));
  const dayNum = dayOfPeriod(monthPeriod(now), now);
  const open = accounts.filter((a) => !a.is_archived);
  // Soonest payment due first.
  const nextDue = (c: Account) =>
    statementPeriods(c, 2)
      .map((p) => p.dueDate)
      .reverse()
      .find((d) => d && d.getTime() >= today)
      ?.getTime() ?? Infinity;
  const cards = open.filter((a) => a.type === 'credit').sort((a, b) => nextDue(a) - nextDue(b));
  const payFrom = open.find((a) => a.type === 'bank')?.id ?? open.find((a) => a.type !== 'credit')?.id;
  const quick = useQuickAddStore((s) => s.open);
  const others = open.filter((a) => a.type !== 'credit');
  const spentOn = (a: Account, since: number, until = Infinity) =>
    txs
      .filter((t) => t.type === 'expense' && t.account_id === a.id && new Date(t.date).getTime() >= since && new Date(t.date).getTime() < until)
      .reduce((s, t) => s + t.amount, 0);
  const toneColor = (u: number) => ({ good: colors.green, fair: colors.orange, high: colors.red })[utilizationTone(u)];

  const totals = cards.reduce(
    (acc, c) => {
      const owed = convertToBase(Math.max(0, -c.balance), c.currency, currency, fxRates);
      const limit = convertToBase(c.credit_limit ?? 0, c.currency, currency, fxRates);
      return { owed: acc.owed + owed, limit: acc.limit + limit };
    },
    { owed: 0, limit: 0 }
  );
  const overallUse = totals.limit > 0 ? totals.owed / totals.limit : 0;

  const stat = (label: string, value: string, color?: string) => (
    <View style={{ flex: 1 }}>
      <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label}</Text>
      <Text style={[typography.headline, { color: color ?? colors.label }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );

  const ownLimit = (a: Account) => {
    if (!a.monthly_limit) return null;
    const spent = spentOn(a, monthStart);
    const u = spent / a.monthly_limit;
    return (
      <View style={{ marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>My monthly limit</Text>
          <Text style={[typography.footnote, { color: u >= 1 ? colors.red : colors.label, fontWeight: '600' }]}>
            {formatMoney(spent, a.currency)} of {formatMoney(a.monthly_limit, a.currency)}
          </Text>
        </View>
        <View style={{ marginTop: 4 }}>
          <ProgressBar progress={u} color={u >= 1 ? colors.red : u >= 0.8 ? colors.orange : colors.blue} height={6} />
        </View>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 3 }]}>
          {u >= 1
            ? `${formatMoney(spent - a.monthly_limit, a.currency)} over this month`
            : `${formatMoney(a.monthly_limit - spent, a.currency)} left · about ${formatMoney(Math.floor((a.monthly_limit - spent) / Math.max(1, daysIn - dayNum + 1)), a.currency)} a day`}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Cards & accounts" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        {cards.length ? (
          <Appear index={0}>
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600', textTransform: 'uppercase' }]}>
                All credit cards · {cards.length}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                {stat('Owed', formatMoneyWhole(totals.owed, currency), totals.owed > 0 ? colors.red : colors.green)}
                {stat('Available', formatMoneyWhole(Math.max(0, totals.limit - totals.owed), currency))}
                {stat('Total limit', totals.limit ? formatMoneyWhole(totals.limit, currency) : '—')}
              </View>
              {totals.limit > 0 ? (
                <>
                  <View style={{ marginTop: spacing.sm }}>
                    <ProgressBar progress={overallUse} color={toneColor(overallUse)} height={8} />
                  </View>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                    {Math.round(overallUse * 100)}% of your credit used — {overallUse < 0.3 ? 'healthy (under 30%)' : 'keeping it under 30% helps your credit score'}
                  </Text>
                </>
              ) : null}
            </Card>
          </Appear>
        ) : null}

        {cards.map((c, i) => {
          const owed = Math.max(0, -c.balance);
          const limit = c.credit_limit ?? 0;
          const u = limit ? owed / limit : 0;
          const periods = statementPeriods(c, 2);
          const due = periods
            .map((p) => p.dueDate)
            .reverse()
            .find((d) => d && d.getTime() >= today);
          const daysToDue = due ? Math.round((due.getTime() - today) / DAY) : null;
          const cycle = periods[0];
          const cycleSpend = spentOn(c, cycle.start.getTime(), cycle.end.getTime());
          const minPay = minimumPayment(owed, c.min_payment_pct);
          const interest = monthlyInterest(owed, c.apr);
          const months = payoffMonths(owed, c.apr, minPay);
          return (
            <Appear key={c.id} index={i + 1}>
              <Card onPress={() => router.push({ pathname: '/money/account/[id]', params: { id: c.id } })} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name="creditcard.fill" color={c.color} size={34} filled />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                      Credit card{c.card_last4 ? ` •• ${c.card_last4}` : ''}
                      {c.apr ? ` · ${c.apr}% a year` : ''}
                    </Text>
                  </View>
                  {daysToDue !== null && owed > 0 ? (
                    <View style={{ backgroundColor: (daysToDue <= 3 ? colors.red : colors.orange) + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={[typography.caption1, { color: daysToDue <= 3 ? colors.red : colors.orange, fontWeight: '700' }]}>
                        {daysToDue === 0 ? 'Due today' : `Due in ${daysToDue}d`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                  {stat('Owed', formatMoneyWhole(owed, c.currency), owed > 0 ? colors.red : colors.green)}
                  {stat('Available', limit ? formatMoneyWhole(Math.max(0, limit - owed), c.currency) : '—')}
                  {stat('Limit', limit ? formatMoneyWhole(limit, c.currency) : 'Not set')}
                </View>
                {limit ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <ProgressBar progress={u} color={toneColor(u)} height={8} />
                    <Text style={[typography.caption1, { color: toneColor(u), marginTop: 3, fontWeight: '600' }]}>{Math.round(u * 100)}% used</Text>
                  </View>
                ) : (
                  <Text style={[typography.caption1, { color: colors.blue, marginTop: spacing.sm }]}>Tap to add the card's limit, due day and interest</Text>
                )}
                <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                    {cycle.label}: <Text style={{ color: colors.label, fontWeight: '600' }}>{formatMoney(cycleSpend, c.currency)}</Text> spent
                    {due ? ` · due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                  {owed > 0 ? (
                    <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                      Minimum {formatMoney(minPay, c.currency)} ({c.min_payment_pct || DEFAULT_MIN_PCT}%)
                      {interest ? ` · about ${formatMoney(interest, c.currency)} interest a month if not paid in full` : ''}
                    </Text>
                  ) : null}
                  {owed > 0 && c.apr ? (
                    <Text style={[typography.footnote, { color: months === null ? colors.red : colors.secondaryLabel, marginTop: 2 }]}>
                      {months === null ? 'Paying only the minimum never clears this card.' : `Paying only the minimum takes about ${months} month${months === 1 ? '' : 's'}.`}
                    </Text>
                  ) : null}
                </View>
                {owed > 0 ? (
                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <Pressable
                      onPress={() => quick('transfer', payFrom, { toAccountId: c.id, amount: minPay })}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: colors.tertiaryFill, marginRight: spacing.sm }}
                    >
                      <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Pay minimum</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => quick('transfer', payFrom, { toAccountId: c.id, amount: owed })}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: colors.blue }}
                    >
                      <Text style={[typography.subhead, { color: '#fff', fontWeight: '600' }]}>Pay in full</Text>
                    </Pressable>
                  </View>
                ) : null}
                {ownLimit(c)}
              </Card>
            </Appear>
          );
        })}

        {others.length ? <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm, marginTop: spacing.sm }]}>Accounts</Text> : null}
        {others.map((a, i) => {
          const month = spentOn(a, monthStart);
          const prevStart = monthPeriod(now, -1).start.getTime();
          const last = spentOn(a, prevStart, prevStart + dayNum * 86400000);
          const perDay = month / Math.max(1, dayNum);
          // How long the balance lasts at this month's pace.
          const runway = perDay > 0 && a.balance > 0 ? Math.floor(a.balance / perDay) : null;
          return (
            <Appear key={a.id} index={cards.length + i + 1}>
              <Card onPress={() => router.push({ pathname: '/money/account/[id]', params: { id: a.id } })} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name={a.icon} color={a.color} size={34} filled />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel, textTransform: 'capitalize' }]}>
                      {a.type}
                      {a.card_last4 ? ` · card •• ${a.card_last4}` : ''}
                    </Text>
                  </View>
                  <Text style={[typography.headline, { color: a.balance < 0 ? colors.red : colors.label }]}>{formatMoney(a.balance, a.currency)}</Text>
                </View>
                <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                  {stat('Spent this month', formatMoneyWhole(month, a.currency))}
                  {stat('Same time last month', formatMoneyWhole(last, a.currency), last && month > last ? colors.orange : undefined)}
                </View>
                {runway !== null ? (
                  <Text style={[typography.caption1, { color: runway < 14 ? colors.orange : colors.secondaryLabel, marginTop: spacing.xs }]}>
                    At {formatMoney(Math.round(perDay), a.currency)} a day, this balance lasts about {runway} day{runway === 1 ? '' : 's'}
                  </Text>
                ) : null}
                {ownLimit(a) ?? (
                  <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>Tap, then Edit, to set your own monthly limit for this account</Text>
                )}
              </Card>
            </Appear>
          );
        })}
      </ScrollView>
    </View>
  );
}
