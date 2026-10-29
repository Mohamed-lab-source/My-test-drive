import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TextField } from '../../../src/ui/TextField';
import { Switch } from '../../../src/ui/Switch';
import { ActivityRings } from '../../../src/ui/ActivityRings';
import { AnimatedNumber } from '../../../src/ui/AnimatedNumber';
import { Appear } from '../../../src/ui/Appear';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { usePlanExtras, useSpendingPlan } from '../../../src/features/money/plan';
import { formatMoneyWhole, fromMinorUnits, toMinorUnits } from '../../../src/utils/money';
import { requestNotificationPermission } from '../../../src/notifications/scheduler';
import { rescheduleMorningAllowance } from '../../../src/notifications/extras';
import type { Limit } from '../../../src/utils/spendingPlan';
import { MonthStartPicker } from '../../../src/features/money/MonthStartPicker';
import { getMonthConfig } from '../../../src/utils/period';
import { todayKey } from '../../../src/db/client';

type LimitKey = 'daily' | 'weekly' | 'monthly';

// How much to save and how much can be spent today, this week and this
// month, worked out from income, bills and savings goals — with your own
// limits and alerts on top.
export default function SpendingPlanScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const router = useRouter();
  const plan = useSpendingPlan();
  const extras = usePlanExtras(plan);
  const [bigInput, setBigInput] = useState(useSettingsStore.getState().bigExpenseAlert ? String(fromMinorUnits(useSettingsStore.getState().bigExpenseAlert)) : '');
  const s = useSettingsStore(useShallow((st) => ({ currency: st.currency, limitAlerts: st.limitAlerts, monthlyIncome: st.monthlyIncome, morningAllowance: st.morningAllowance, notificationsEnabled: st.notificationsEnabled, savingsPct: st.savingsPct, setBigExpenseAlert: st.setBigExpenseAlert, setDailySpendAlert: st.setDailySpendAlert, setLimitAlerts: st.setLimitAlerts, setMonthlyIncome: st.setMonthlyIncome, setMonthlyLimit: st.setMonthlyLimit, setMorningAllowance: st.setMorningAllowance, setSavingsPct: st.setSavingsPct, setWeeklyLimit: st.setWeeklyLimit, monthFromPayday: st.monthFromPayday, addManualPayday: st.addManualPayday })));
  const [editing, setEditing] = useState<LimitKey | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [incomeInput, setIncomeInput] = useState(s.monthlyIncome ? String(fromMinorUnits(s.monthlyIncome)) : '');
  const money = (n: number) => formatMoneyWhole(n, s.currency);

  if (!plan) return <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}><NavHeader title="Spending plan" /></View>;

  const setLimit = (key: LimitKey, value: number) => {
    if (key === 'daily') s.setDailySpendAlert(value);
    else if (key === 'weekly') s.setWeeklyLimit(value);
    else s.setMonthlyLimit(value);
  };
  const tone = (l: Limit) => (l.progress >= 1 ? colors.red : l.progress >= 0.8 ? colors.orange : colors.green);
  const statusText =
    plan.status === 'over'
      ? `Over this month's limit by ${money(plan.monthly.spent - plan.monthly.limit)}`
      : plan.status === 'watch'
        ? `At this pace you'll spend ${money(plan.projectedMonthEnd)} — ${money(plan.projectedMonthEnd - plan.monthly.limit)} over`
        : `On track — heading for ${money(plan.projectedMonthEnd)} of ${money(plan.monthly.limit)}`;
  const statusColor = plan.status === 'over' ? colors.red : plan.status === 'watch' ? colors.orange : colors.green;
  // To finish the month on budget from here.
  const cutPerDay = plan.status !== 'on-track' && plan.daysLeft > 0 ? (plan.projectedMonthEnd - plan.monthly.limit) / plan.daysLeft : 0;

  const limitRow = (key: LimitKey, title: string, l: Limit, sub: string) => (
    <View key={key} style={{ paddingVertical: spacing.sm, borderTopWidth: key === 'daily' ? 0 : 0.5, borderTopColor: colors.separator }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>{title}</Text>
        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
          <Text style={{ color: colors.label, fontWeight: '700' }}>{money(l.spent)}</Text> of {money(l.limit)}
        </Text>
      </View>
      <View style={{ marginVertical: 6 }}>
        <ProgressBar progress={l.progress} color={tone(l)} height={8} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[typography.footnote, { color: l.left >= 0 ? colors.secondaryLabel : colors.red, flex: 1 }]}>
          {l.left >= 0 ? `${money(l.left)} left ${sub}` : `${money(-l.left)} over ${sub}`}
          {l.custom ? ' · your limit' : ' · from your plan'}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            setLimitInput(l.custom ? String(fromMinorUnits(l.limit)) : '');
            setEditing(editing === key ? null : key);
          }}
        >
          <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600' }]}>{editing === key ? 'Close' : 'Change'}</Text>
        </Pressable>
      </View>
      {editing === key ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextField
            placeholder={`Suggested ${money(l.suggested)}`}
            keyboardType="decimal-pad"
            value={limitInput}
            onChangeText={setLimitInput}
            autoFocus
            onSubmitEditing={() => {
              setLimit(key, toMinorUnits(Number(limitInput) || 0));
              setEditing(null);
            }}
          />
          <View style={{ flexDirection: 'row', marginTop: -spacing.xs }}>
            <Pressable
              onPress={() => {
                setLimit(key, toMinorUnits(Number(limitInput) || 0));
                setEditing(null);
              }}
              style={{ marginRight: spacing.lg }}
            >
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '700' }]}>Save</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLimit(key, 0);
                setEditing(null);
              }}
            >
              <Text style={[typography.subhead, { color: colors.blue }]}>Use the plan's {money(l.suggested)}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  // Income → bills → savings → spending money, as one bar.
  const total = Math.max(1, plan.income);
  const segments = [
    { label: 'Bills', value: Math.min(plan.bills, plan.income), color: colors.indigo },
    { label: 'Savings', value: Math.min(plan.saveMonthly, Math.max(0, plan.income - plan.bills)), color: colors.green },
    { label: 'Spending', value: plan.spendable, color: colors.blue },
  ];

  // Payday months: the expected salary hasn't shown up yet.
  const { monthFromPayday, addManualPayday } = s;
  const paydays = getMonthConfig().paydays;
  const lastPayday = paydays.length ? new Date(paydays[paydays.length - 1]) : null;
  const salaryLate =
    monthFromPayday && !!lastPayday && Date.now() > new Date(lastPayday.getFullYear(), lastPayday.getMonth() + 1, lastPayday.getDate() + 1).getTime();

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Spending plan"
        right={
          <Pressable
            hitSlop={8}
            onPress={() =>
              Share.share({
                message: [
                  `My spending plan (${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })})`,
                  `Income ${money(plan.income)} · bills ${money(plan.bills)} · save ${money(plan.saveMonthly)}`,
                  `Spending money ${money(plan.spendable)} (about ${money(plan.spendable / plan.daysInMonth)} a day)`,
                  `This month: ${money(plan.monthly.spent)} spent, ${money(Math.max(0, plan.monthly.left))} left`,
                ].join('\n'),
              })
            }
          >
            <Text style={[typography.subhead, { color: colors.blue }]}>Share</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {salaryLate ? (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.orange + '1F' }}>
            <Text style={[typography.headline, { color: colors.label }]}>⏳ Your salary looks late</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
              This month stays open until it arrives, so today's allowance covers every day until then.
            </Text>
            <Pressable onPress={() => addManualPayday(todayKey())} style={{ marginTop: spacing.sm }}>
              <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>It arrived today — start a new month</Text>
            </Pressable>
          </Card>
        ) : null}
        <Appear index={0}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <ActivityRings
              size={124}
              stroke={13}
              rings={[
                { progress: plan.daily.progress, color: tone(plan.daily) },
                { progress: plan.weekly.progress, color: colors.cyan },
                { progress: plan.monthly.progress, color: colors.purple },
              ]}
            />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600', textTransform: 'uppercase' }]}>Left to spend today</Text>
              <AnimatedNumber
                value={Math.max(0, plan.daily.left)}
                format={money}
                style={[typography.title1, { color: plan.daily.left > 0 ? colors.label : colors.red }]}
                numberOfLines={1}
              />
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                <Text style={{ color: colors.cyan, fontWeight: '700' }}>●</Text> week {money(Math.max(0, plan.weekly.left))}
                {'  '}
                <Text style={{ color: colors.purple, fontWeight: '700' }}>●</Text> month {money(Math.max(0, plan.monthly.left))}
              </Text>
            </View>
          </Card>
        </Appear>

        <Appear index={1}>
          <View style={{ backgroundColor: statusColor + '1F', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md }}>
            <Text style={[typography.subhead, { color: statusColor, fontWeight: '600' }]}>{statusText}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
              At an even pace you'd have spent {money(plan.expectedByToday)} by today; you've spent {money(plan.monthly.spent)}.
              {cutPerDay > 0 ? ` Spend about ${money(cutPerDay)} less a day to finish on budget.` : ''}
            </Text>
          </View>
        </Appear>

        <Appear index={2}>
          <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Limits</Text>
          <Card style={{ marginBottom: spacing.md }}>
            {limitRow('daily', 'Today', plan.daily, 'today')}
            {limitRow('weekly', 'This week', plan.weekly, 'this week')}
            {limitRow('monthly', 'This month', plan.monthly, `· ${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'} to go`)}
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
              Counts everyday spending; bills you've set up are already in the plan.
            </Text>
          </Card>
        </Appear>

        <Appear index={3}>
          <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Your monthly plan</Text>
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Income{plan.incomeEstimated ? ' (average of last 3 months)' : ''}</Text>
              <Text style={[typography.headline, { color: colors.label }]}>{money(plan.income)}</Text>
            </View>
            <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.tertiaryFill, marginVertical: spacing.sm }}>
              {segments.map((g) => (g.value > 0 ? <View key={g.label} style={{ flex: g.value / total, backgroundColor: g.color }} /> : null))}
            </View>
            {[
              { label: 'Bills & subscriptions', value: plan.bills, color: colors.indigo, onPress: () => router.push('/money/subscriptions') },
              { label: 'Save each month', value: plan.saveMonthly, color: colors.green, onPress: () => router.push('/money/savings') },
              { label: 'Spending money', value: plan.spendable, color: colors.blue },
            ].map((r) => (
              <Pressable key={r.label} onPress={r.onPress} disabled={!r.onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color, marginRight: 8 }} />
                <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{r.label}</Text>
                <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>{money(r.value)}</Text>
              </Pressable>
            ))}
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
              That's about {money(plan.spendable / plan.daysInMonth)} a day or {money((plan.spendable / plan.daysInMonth) * 7)} a week.
            </Text>
            {plan.income === 0 ? (
              <Text style={[typography.footnote, { color: colors.orange, marginTop: spacing.xs }]}>Enter your monthly income below to build your plan.</Text>
            ) : plan.spendable === 0 ? (
              <Text style={[typography.footnote, { color: colors.orange, marginTop: spacing.xs }]}>
                Bills and savings take all of your income — lower the savings share or review your bills.
              </Text>
            ) : null}
            <View style={{ marginTop: spacing.md }}>
              <TextField
                label="Monthly income"
                placeholder={plan.incomeEstimated && plan.income ? `Estimated ${money(plan.income)}` : 'e.g. 30000'}
                keyboardType="decimal-pad"
                value={incomeInput}
                onChangeText={setIncomeInput}
                onBlur={() => s.setMonthlyIncome(toMinorUnits(Number(incomeInput) || 0))}
              />
            </View>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Save at least</Text>
            <ChipSelector
              options={[0, 10, 15, 20, 25, 30].map((p) => ({ id: String(p), label: p ? `${p}% of income` : 'Goals only' }))}
              selectedId={String(s.savingsPct)}
              onSelect={(id) => s.setSavingsPct(Number(id))}
            />
          </Card>
        </Appear>

        {extras ? (
          <Appear index={4}>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>This month at a glance</Text>
            <Card style={{ marginBottom: spacing.md }}>
              {extras.daysToPayday !== null ? (
                <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]}>💰 Next payday</Text>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>
                    {extras.daysToPayday === 0 ? 'Today' : `in ${extras.daysToPayday} day${extras.daysToPayday === 1 ? '' : 's'}`}
                  </Text>
                </View>
              ) : null}
              {extras.daysToPayday ? (
                <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: -2, marginBottom: 4 }]}>
                  {money(Math.max(0, plan.monthly.left) / extras.daysToPayday)} a day until then from what's left this month
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]}>🌱 No-spend days</Text>
                <Text style={[typography.body, { color: colors.green, fontWeight: '600' }]}>
                  {extras.noSpendDays}
                  {extras.noSpendStreak > 1 ? ` · ${extras.noSpendStreak} in a row` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]}>📅 Average day</Text>
                <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>
                  {money(extras.weekdayAvg)} weekday · {money(extras.weekendAvg)} weekend
                </Text>
              </View>
              {extras.biggest ? (
                <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                    🧾 Biggest: {extras.biggest.note}
                  </Text>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>{money(extras.biggest.amount)}</Text>
                </View>
              ) : null}
              {extras.topCategories.length ? (
                <View style={{ marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.tertiaryFill }}>
                    {extras.topCategories.map((c) => (
                      <View key={c.name} style={{ flex: c.share, backgroundColor: c.color }} />
                    ))}
                    <View style={{ flex: Math.max(0, 1 - extras.topCategories.reduce((a, c) => a + c.share, 0)) }} />
                  </View>
                  {extras.topCategories.map((c) => (
                    <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color, marginRight: 6 }} />
                      <Text style={[typography.footnote, { color: colors.label, flex: 1 }]}>{c.name}</Text>
                      <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                        {money(c.total)} · {Math.round(c.share * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>🛟 Emergency fund</Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                    {money(extras.emergencySaved)} of {money(extras.emergencyTarget)}
                  </Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar progress={extras.emergencyTarget ? extras.emergencySaved / extras.emergencyTarget : 0} color={colors.teal} height={6} />
                </View>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  Three months of bills and spending, counted from your savings accounts.
                </Text>
              </View>
            </Card>
          </Appear>
        ) : null}

        <Appear index={4}>
          <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Saving for goals</Text>
          <Card style={{ marginBottom: spacing.md }}>
            {plan.goalBreakdown.length ? (
              plan.goalBreakdown.map((g) => (
                <View key={g.name} style={{ flexDirection: 'row', paddingVertical: 5 }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={[typography.body, { color: colors.green, fontWeight: '600' }]}>
                    {money(g.perMonth)}/mo{g.dated ? '' : '*'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>No savings goals yet.</Text>
            )}
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
              {plan.goalBreakdown.some((g) => !g.dated) ? '* No target date, so spread over a year. ' : ''}
              {plan.saveMonthly > plan.goalSaving
                ? `Your ${s.savingsPct}% savings share (${money(plan.saveMonthly)}) covers these goals and more.`
                : `Goals need ${money(plan.goalSaving)} a month.`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, rowGap: 6 }}>
              <Pressable onPress={() => router.push('/money/savings')} style={{ marginRight: spacing.lg }}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Manage goals ›</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/money/insights')} style={{ marginRight: spacing.lg }}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Where it goes ›</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/money/limits')}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Card limits ›</Text>
              </Pressable>
            </View>
          </Card>
        </Appear>

        <Appear index={5}>
          <Card style={{ marginBottom: spacing.md }}>
            <MonthStartPicker />
          </Card>
          <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Alerts</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Limit alerts</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  At 80% and 100% of your daily, weekly and monthly limits, each account's own limit, and 30/70/90% of a card's credit
                </Text>
              </View>
              <Switch
                value={s.limitAlerts}
                onValueChange={async (v) => {
                  if (v && !s.notificationsEnabled && !(await requestNotificationPermission())) {
                    Alert.alert('Notifications are off', 'Allow notifications for Anchor in your phone settings.');
                    return;
                  }
                  s.setLimitAlerts(v);
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Morning allowance</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>8:30 AM: how much you can spend today</Text>
              </View>
              <Switch
                value={s.morningAllowance}
                onValueChange={async (v) => {
                  if (v && !s.notificationsEnabled && !(await requestNotificationPermission())) {
                    Alert.alert('Notifications are off', 'Allow notifications for Anchor in your phone settings.');
                    return;
                  }
                  s.setMorningAllowance(v);
                  await rescheduleMorningAllowance();
                }}
              />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <TextField
                label="Alert me for any single expense over"
                placeholder="Off — e.g. 2000"
                keyboardType="decimal-pad"
                value={bigInput}
                onChangeText={setBigInput}
                onBlur={() => s.setBigExpenseAlert(toMinorUnits(Number(bigInput) || 0))}
              />
            </View>
          </Card>
        </Appear>
      </ScrollView>
    </View>
  );
}
