import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ProgressRing } from '../../../src/ui/ProgressRing';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/finance';
import { convertToBase } from '../../../src/db/repositories/fx';
import { formatMoney } from '../../../src/utils/money';
import { formatDateKey, localDateKey } from '../../../src/utils/date';
import * as I from '../../../src/utils/moneyInsights';
import { SpendingCalendar } from '../../../src/features/money/SpendingCalendar';
import type { Transaction } from '../../../src/db/types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Insight({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: 4 }]}>
        {emoji} {title}
      </Text>
      {children}
    </Card>
  );
}

export default function InsightsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { categories, accounts, budgets, debts, fxRates, transactions: recent } = useFinanceStore();
  const { currency, weekendDays, weekStart } = useSettingsStore();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const from = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
    repo.listTransactionsInRange(from, new Date(Date.now() + 86400000).toISOString()).then(setTxs);
  }, [recent]);

  const toBase = (amount: number, cur: string) => convertToBase(amount, cur, currency, fxRates);
  const money = (n: number) => formatMoney(Math.round(n), currency);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  const month = I.monthKeyOf(now);
  const prevMonth = I.monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const day = now.getDate();
  const daysInPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();

  const data = useMemo(() => {
    if (!txs) return null;
    const sp = I.toSpends(txs, toBase);
    const monthSpent = sp.filter((s) => s.month === month).reduce((a, s) => a + s.amount, 0);
    const monthIncome = txs
      .filter((t) => t.type === 'income' && localDateKey(t.date).slice(0, 7) === month)
      .reduce((a, t) => a + toBase(t.amount, t.currency), 0);
    const lastIncome = txs
      .filter((t) => t.type === 'income' && localDateKey(t.date).slice(0, 7) === prevMonth)
      .reduce((a, t) => a + toBase(t.amount, t.currency), 0);
    const lastSpent = sp.filter((s) => s.month === prevMonth).reduce((a, s) => a + s.amount, 0);
    const rate = monthIncome > 0 ? (monthIncome - monthSpent) / monthIncome : lastIncome > 0 ? (lastIncome - lastSpent) / lastIncome : null;
    const elapsed = day / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const over = budgets.filter((b) => {
      const spent = sp.filter((s) => s.month === month && s.categoryId === b.category_id).reduce((a, s) => a + s.amount, 0);
      return spent > b.monthly_limit * Math.max(elapsed, 0.01) * 1.1;
    });
    const liquid = accounts.filter((a) => a.type !== 'credit').reduce((a, x) => a + toBase(x.balance, x.currency), 0);
    const avgMonth = (() => {
      const months = [1, 2, 3].map((i) => I.monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
      const tot = sp.filter((s) => months.includes(s.month)).reduce((a, s) => a + s.amount, 0);
      return tot / 3;
    })();
    const cards = accounts.filter((a) => a.type === 'credit' && (a.credit_limit ?? 0) > 0);
    const util = cards.length
      ? cards.reduce((a, c) => a + Math.max(0, -c.balance), 0) / cards.reduce((a, c) => a + (c.credit_limit ?? 0), 0)
      : null;
    const owe = debts.filter((d) => d.direction === 'i_owe' && d.status !== 'paid').reduce((a, d) => a + toBase(d.remaining_amount, d.currency), 0);
    const income = monthIncome || lastIncome;
    const health = I.healthScore({
      savingsRate: rate,
      budgetsOver: over.length,
      budgetsTotal: budgets.length,
      runwayMonths: avgMonth > 0 ? liquid / avgMonth : null,
      creditUtilisation: util,
      debtToIncome: income > 0 ? owe / income : owe > 0 ? 3 : null,
    });
    const incomes = txs.filter((t) => t.type === 'income').map((t) => ({ date: new Date(t.date), amount: toBase(t.amount, t.currency) }));
    const weekendFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
    return {
      sp,
      monthSpent,
      lastSpent,
      health,
      rides: I.groupStats(sp, I.RIDE_HAILING, month, prevMonth),
      delivery: I.groupStats(sp, I.FOOD_DELIVERY, month, prevMonth),
      groceries: I.groupStats(sp, I.GROCERIES, month, prevMonth),
      fees: sp.filter((s) => s.merchant && I.FEES.test(s.merchant) && s.date.getFullYear() === now.getFullYear()),
      unusual: I.unusualCharges(sp, now),
      prices: I.priceChanges(sp).slice(0, 4),
      dayparts: I.byDaypart(sp.filter((s) => s.date.getTime() > Date.now() - 90 * 86400000)),
      weekend: I.weekendVsWeekday(sp, weekendDays, weekendFrom, now),
      late: I.lateNight(sp, month),
      small: I.smallPurchases(sp, month),
      ticket: I.averageTicket(sp, month),
      shifts: I.categoryShifts(sp, month, prevMonth, day, daysInPrev),
      uncategorised: I.uncategorisedShare(sp, month),
      recurring: I.recurringShare(sp, month),
      top: I.topMerchants(sp, `${now.getFullYear()}-01-01`),
      habitual: I.habitualMerchants(sp, I.monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 2, 1)) + '-01'),
      inflation: I.personalInflation(sp, now),
      biggest: I.biggestDay(sp),
      noSpend: I.noSpendStreaks(sp, now),
      dailyNow: I.dailyAverage(sp, month, day),
      dailyPrev: I.dailyAverage(sp, prevMonth, daysInPrev),
      payday: I.paydayEffect(sp, incomes, now),
      saving: I.savingStreak(txs, toBase, now),
      sources: I.incomeSources(txs, toBase, `${now.getFullYear()}-01-01`, catName),
      tags: I.tagTotals(txs, toBase, month).slice(0, 5),
      atm: I.atmStats(txs, accounts, toBase, month),
      foreign: I.foreignSpend(txs, currency, toBase, month),
      ytd: I.yearToDate(sp, now),
      halves: I.monthHalves(sp, [1, 2, 3].map((i) => I.monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)))),
      weekdayTotals: (() => {
        const t = Array(7).fill(0);
        for (const s of sp) if (s.date.getTime() > Date.now() - 90 * 86400000) t[s.date.getDay()] += s.amount;
        return t;
      })(),
    };
  }, [txs, currency, fxRates, accounts, budgets, debts, weekendDays]);

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Insights" />
      </View>
    );
  }

  const sub = (text: string, color: string = colors.secondaryLabel, key?: string) => (
    <Text key={key} style={[typography.subhead, { color, marginTop: 2 }]}>
      {text}
    </Text>
  );
  const vs = (now: number, before: number) =>
    before > 0 ? ` (${now >= before ? '▲' : '▼'} ${Math.abs(Math.round((now / before - 1) * 100))}% vs last month)` : '';

  // A short narrative of the month so far.
  const story = [
    `You've spent ${money(data.monthSpent)} so far this month${vs(data.dailyNow, data.dailyPrev).replace('vs last month', 'per day vs last month')}.`,
    data.shifts.up && data.shifts.up.now - data.shifts.up.before > 0
      ? `${catName(data.shifts.up.categoryId)} is up the most (${money(data.shifts.up.now - data.shifts.up.before)} more than this point last month).`
      : null,
    data.rides.count ? `${data.rides.count} ride${data.rides.count === 1 ? '' : 's'} cost ${money(data.rides.total)}.` : null,
    data.noSpend.thisMonth ? `${data.noSpend.thisMonth} no-spend day${data.noSpend.thisMonth === 1 ? '' : 's'} so far.` : null,
    data.saving ? `You've saved money ${data.saving} month${data.saving === 1 ? '' : 's'} in a row.` : null,
  ].filter(Boolean) as string[];

  const share = () => {
    const lines = [
      `Anchor insights — ${now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`,
      ...story,
      `Financial health score: ${data.health.score}/100`,
      data.top[0] ? `Top merchant this year: ${data.top[0].name} (${money(data.top[0].total)})` : null,
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') });
  };

  const maxDaypart = Math.max(1, ...data.dayparts);
  const maxWeekday = Math.max(1, ...data.weekdayTotals);
  const healthColor = data.health.score >= 70 ? colors.green : data.health.score >= 45 ? colors.orange : colors.red;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Insights"
        right={
          <Pressable onPress={share} hitSlop={8}>
            <Text style={[typography.subhead, { color: colors.blue }]}>Share</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: 4 }]}>📝 Your month so far</Text>
          {story.map((line, i) => (
            <Text key={i} style={[typography.body, { color: colors.label, marginTop: 2 }]}>
              {line}
            </Text>
          ))}
        </Card>

        <SpendingCalendar spends={data.sp} currency={currency} weekStart={weekStart} />

        <Card style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <ProgressRing progress={data.health.score / 100} color={healthColor} size={72} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Financial health {data.health.score}/100</Text>
            {data.health.parts.map((p) => (
              <View key={p.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{p.label}</Text>
                <Text style={[typography.caption1, { color: p.points >= p.max * 0.7 ? colors.green : p.points >= p.max * 0.4 ? colors.orange : colors.red }]}>
                  {p.points}/{p.max}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Insight emoji="🚗" title="Rides (Uber, Careem…)">
          {data.rides.count || data.rides.prevCount ? (
            <>
              {sub(`${data.rides.count} trip${data.rides.count === 1 ? '' : 's'} this month · ${money(data.rides.total)}${vs(data.rides.total, data.rides.prevTotal)}`)}
              {data.rides.count ? sub(`About ${money(data.rides.avg)} per trip`) : null}
            </>
          ) : (
            sub('No rides logged yet. Uber and Careem charges from bank SMS show up here.')
          )}
        </Insight>

        <Insight emoji="🛵" title="Delivery vs groceries">
          {sub(`Delivery: ${money(data.delivery.total)} (${data.delivery.count} orders)`)}
          {sub(`Groceries: ${money(data.groceries.total)} (${data.groceries.count} trips)`)}
          {data.delivery.total > data.groceries.total && data.delivery.total > 0
            ? sub('You spend more on delivery than on groceries this month.', colors.orange)
            : null}
        </Insight>

        {data.unusual.length ? (
          <Insight emoji="⚠️" title="Unusual charges (30 days)">
            {data.unusual.map((s) => (
              <Text key={s.id} style={[typography.subhead, { color: colors.label, marginTop: 2 }]}>
                {money(s.amount)} · {s.merchant ?? catName(s.categoryId)} · {formatDateKey(s.key)}
              </Text>
            ))}
            {sub('Each is more than 3× your usual for its category.')}
          </Insight>
        ) : null}

        {data.prices.length ? (
          <Insight emoji="📈" title="Price changes">
            {data.prices.map((p) => (
              <Text key={p.merchant} style={[typography.subhead, { color: p.after > p.before ? colors.red : colors.green, marginTop: 2 }]}>
                {p.merchant}: {money(p.before)} → {money(p.after)}
              </Text>
            ))}
            {sub('Monthly charges whose amount changed recently.')}
          </Insight>
        ) : null}

        <Insight emoji="📊" title="Biggest changes vs last month">
          {data.shifts.up ? sub(`▲ ${catName(data.shifts.up.categoryId)}: ${money(data.shifts.up.before)} → ${money(data.shifts.up.now)}`, colors.red) : null}
          {data.shifts.down ? sub(`▼ ${catName(data.shifts.down.categoryId)}: ${money(data.shifts.down.before)} → ${money(data.shifts.down.now)}`, colors.green) : null}
          {!data.shifts.up && !data.shifts.down ? sub('Not enough data yet.') : null}
          {sub(`Compared with the first ${day} days of last month.`)}
        </Insight>

        <Insight emoji="📅" title="Daily average">
          {sub(`${money(data.dailyNow)} per day this month vs ${money(data.dailyPrev)} last month`)}
          {data.halves.firstPerDay + data.halves.secondPerDay > 0
            ? sub(
                data.halves.firstPerDay > data.halves.secondPerDay * 1.2
                  ? `You usually spend more in the first half of the month (${money(data.halves.firstPerDay)}/day vs ${money(data.halves.secondPerDay)}/day).`
                  : data.halves.secondPerDay > data.halves.firstPerDay * 1.2
                    ? `You usually spend more in the second half of the month (${money(data.halves.secondPerDay)}/day vs ${money(data.halves.firstPerDay)}/day).`
                    : 'Your spending is even across the month.'
              )
            : null}
        </Insight>

        <Insight emoji="🕐" title="When you spend (90 days)">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, marginTop: spacing.sm }}>
            {data.dayparts.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: 22, borderRadius: 4, height: Math.max(3, (v / maxDaypart) * 70), backgroundColor: colors.indigo }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {I.DAYPARTS.map((p) => (
              <Text key={p.label} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.tertiaryLabel }]}>
                {p.label}
              </Text>
            ))}
          </View>
          {data.late.count ? sub(`${data.late.count} late-night purchase${data.late.count === 1 ? '' : 's'} (11 PM–4 AM) this month: ${money(data.late.total)}`) : null}
        </Insight>

        <Insight emoji="🗓️" title="Weekdays">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, marginTop: spacing.sm }}>
            {data.weekdayTotals.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 18,
                    borderRadius: 4,
                    height: Math.max(3, (v / maxWeekday) * 60),
                    backgroundColor: weekendDays.includes(i) ? colors.orange : colors.blue,
                  }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAY_NAMES.map((d) => (
              <Text key={d} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.tertiaryLabel }]}>
                {d.slice(0, 3)}
              </Text>
            ))}
          </View>
          {sub(`Weekend days average ${money(data.weekend.weekend)}; weekdays ${money(data.weekend.weekday)} (last 90 days).`)}
        </Insight>

        <Insight emoji="☕" title="Small purchases add up">
          {sub(`${data.small.count} purchases of ${money(data.small.threshold)} or less this month = ${money(data.small.total)}`)}
          {sub(`Average purchase: ${money(data.ticket.now)} now vs ${money(data.ticket.usual)} usually`)}
        </Insight>

        <Insight emoji="🔁" title="Where you go regularly">
          {data.habitual.length
            ? data.habitual.map((m) => (
                <Pressable key={m.name} onPress={() => router.push({ pathname: '/money/merchant', params: { name: m.name } })}>
                  {sub(`${m.name}: ${m.count} visits, about every ${m.every} day${m.every === 1 ? '' : 's'} · ${money(m.total)} ›`, colors.blue)}
                </Pressable>
              ))
            : sub('Shows up once you have a few repeat visits.')}
        </Insight>

        <Insight emoji="🏆" title="Top merchants this year">
          {data.top.length ? data.top.map((m, i) => (
                <Pressable key={m.name} onPress={() => router.push({ pathname: '/money/merchant', params: { name: m.name } })}>
                  {sub(`${i + 1}. ${m.name} — ${money(m.total)} (${m.count}×) ›`, colors.blue)}
                </Pressable>
              )) : sub('No merchants yet.')}
        </Insight>

        {data.inflation ? (
          <Insight emoji="🏷️" title="Your personal inflation">
            {sub(
              `At the ${data.inflation.merchants} places you visit regularly, an average visit costs ${Math.abs(Math.round(data.inflation.change * 100))}% ${data.inflation.change >= 0 ? 'more' : 'less'} than 2–4 months ago.`,
              data.inflation.change > 0.05 ? colors.red : colors.secondaryLabel
            )}
          </Insight>
        ) : null}

        <Insight emoji="🌱" title="No-spend days">
          {sub(`${data.noSpend.thisMonth} this month · current run ${data.noSpend.current} · best run ${data.noSpend.longest}`)}
        </Insight>

        {data.biggest ? (
          <Insight emoji="💥" title="Most expensive day">
            {sub(`${formatDateKey(data.biggest.key)}: ${money(data.biggest.total)}`)}
          </Insight>
        ) : null}

        {data.payday ? (
          <Insight emoji="💸" title="Payday effect">
            {sub(`In the week after payday you spend about ${money(data.payday.weekAfter)}, vs ${money(data.payday.avgWeek)} in an average week.`)}
          </Insight>
        ) : null}

        <Insight emoji="🐷" title="Saving streak">
          {sub(data.saving ? `You earned more than you spent ${data.saving} month${data.saving === 1 ? '' : 's'} in a row.` : 'Last month you spent more than you earned — or there is no income logged.')}
        </Insight>

        {data.sources.length ? (
          <Insight emoji="💼" title="Income sources this year">
            {data.sources.slice(0, 5).map((s) => sub(`${s.name}: ${money(s.total)}`, undefined, s.name))}
          </Insight>
        ) : null}

        <Insight emoji="🧾" title="Fixed vs flexible">
          <View style={{ marginTop: 6 }}>
            <ProgressBar progress={data.recurring} color={colors.purple} />
          </View>
          {sub(`${Math.round(data.recurring * 100)}% of this month's spending is recurring bills; the rest is flexible.`)}
          {data.uncategorised > 0.1 ? (
            <Pressable onPress={() => router.push('/money/uncategorized')}>
              {sub(`${Math.round(data.uncategorised * 100)}% has no category — tap to sort it for better insights.`, colors.blue)}
            </Pressable>
          ) : null}
        </Insight>

        {data.fees.length ? (
          <Insight emoji="🏦" title="Bank fees this year">
            {sub(`${data.fees.length} charge${data.fees.length === 1 ? '' : 's'} totalling ${money(data.fees.reduce((a, s) => a + s.amount, 0))}`, colors.red)}
          </Insight>
        ) : null}

        {data.atm.count ? (
          <Insight emoji="🏧" title="Cash withdrawals">
            {sub(`${data.atm.count} this month · ${money(data.atm.total)} · ${money(data.atm.avg)} each`)}
          </Insight>
        ) : null}

        {data.foreign.count ? (
          <Insight emoji="🌍" title="Foreign currency">
            {sub(`${data.foreign.count} charge${data.foreign.count === 1 ? '' : 's'} in other currencies this month ≈ ${money(data.foreign.total)}`)}
          </Insight>
        ) : null}

        {data.tags.length ? (
          <Insight emoji="#️⃣" title="Tags this month">
            {data.tags.map((t) => sub(`#${t.tag}: ${money(t.total)}`, undefined, t.tag))}
          </Insight>
        ) : null}

        {(() => {
          const year = String(now.getFullYear());
          const totals = new Map<string, number>();
          for (const sp of data.sp) if (sp.month.startsWith(year)) totals.set(sp.categoryId ?? '', (totals.get(sp.categoryId ?? '') ?? 0) + sp.amount);
          const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
          const all = [...totals.values()].reduce((a, b) => a + b, 0);
          return top.length ? (
            <Insight emoji="🗂️" title="Top categories this year">
              {top.map(([id, v]) => sub(`${catName(id || null)}: ${money(v)} (${Math.round((v / all) * 100)}%)`, undefined, id || 'none'))}
            </Insight>
          ) : null;
        })()}

        <Insight emoji="📆" title="Year to date">
          {sub(`${money(data.ytd.thisYear)} spent in ${now.getFullYear()}`)}
          {data.ytd.lastYear !== null
            ? sub(`${money(data.ytd.lastYear)} by this date last year${vs(data.ytd.thisYear, data.ytd.lastYear).replace('last month', 'last year')}`)
            : null}
        </Insight>
      </ScrollView>
    </View>
  );
}
