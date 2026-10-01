import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../src/store/financeStore';
import { useProductivityStore } from '../../src/store/productivityStore';
import { useLifeStore } from '../../src/store/lifeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/ui/Card';
import { IconCircle } from '../../src/ui/IconCircle';
import { Icon } from '../../src/ui/Icon';
import { PrayerTracker } from '../../src/features/life/PrayerTracker';
import { RamadanCard } from '../../src/features/home/RamadanCard';
import { VerseCard } from '../../src/features/home/VerseCard';
import { CountdownCard } from '../../src/features/home/CountdownCard';
import { WaterCard } from '../../src/features/home/WaterCard';
import { CustomizeHomeSheet } from '../../src/features/home/CustomizeHomeSheet';
import { NextPrayerChip } from '../../src/features/home/NextPrayerChip';
import { GettingStartedCard } from '../../src/features/home/GettingStartedCard';
import { AddTransactionSheet } from '../../src/features/money/AddTransactionSheet';
import { AddTaskSheet } from '../../src/features/tasks/AddTaskSheet';
import { formatMoney } from '../../src/utils/money';
import { convertToBase } from '../../src/db/repositories/fx';
import { reconstructNetWorthTrend } from '../../src/utils/networth';
import { formatHijri } from '../../src/utils/hijri';
import { formatRelativeDay, formatTime, isOverdue, localDateKey } from '../../src/utils/date';
import { todayKey } from '../../src/db/client';

const SPARKLINE_DAYS = 14;

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center' }}>
      <IconCircle name={icon} color={color} size={48} />
      <Text style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);
  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [taskVisible, setTaskVisible] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const hiddenHomeCards = useSettingsStore((s) => s.hiddenHomeCards);
  const show = (id: string) => !hiddenHomeCards.includes(id);
  const { accounts, transactions, recurringRules, debts, fxRates, netWorthHistory } = useFinanceStore();
  const { tasks, meetings } = useProductivityStore();
  const prayerStreak = useLifeStore((s) => s.prayerStreak);

  const netWorth = accounts.reduce(
    (sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates),
    0
  );
  const todayStr = todayKey();
  const topTask = useSettingsStore((s) => s.topTask);
  const topTaskId = topTask && topTask.date === todayStr ? topTask.id : null;
  // Today's top task (if any) leads the list, even if it's scheduled elsewhere.
  const todayTasks = useMemo(() => {
    const list = tasks.filter(
      (t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress' || t.id === topTaskId)
    );
    return list.sort((a, b) => Number(b.id === topTaskId) - Number(a.id === topTaskId));
  }, [tasks, todayStr, topTaskId]);
  const todayMeetings = useMemo(
    () => meetings.filter((m) => localDateKey(m.start_at) === todayStr),
    [meetings, todayStr]
  );
  const upcomingBills = useMemo(
    () =>
      recurringRules
        .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
        .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
        .slice(0, 3),
    [recurringRules]
  );
  const openDebts = debts.filter((d) => d.status !== 'paid');

  const monthStart = todayStr.slice(0, 8) + '01';
  const monthSpend = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense' && localDateKey(t.date) >= monthStart)
        .reduce((sum, t) => sum + convertToBase(t.amount, t.currency, currency, fxRates), 0),
    [transactions, monthStart, currency, fxRates]
  );

  // Reconstructed from transactions, with real daily snapshots taking over
  // for any day that has one (reconstruction can't see manual balance edits).
  const sparkline = useMemo(() => {
    const estimated = reconstructNetWorthTrend(netWorth, transactions, SPARKLINE_DAYS, currency, fxRates);
    const snapshots = new Map(netWorthHistory.filter((h) => h.currency === currency).map((h) => [h.id, h.amount]));
    const now = new Date();
    return estimated.map((value, i) => {
      const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SPARKLINE_DAYS - 1 - i)));
      return snapshots.get(key) ?? value;
    });
  }, [netWorth, transactions, currency, fxRates, netWorthHistory]);
  const sparkMin = Math.min(...sparkline);
  const sparkMax = Math.max(...sparkline);
  const sparkRange = Math.max(1, sparkMax - sparkMin);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          <View>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
              {greeting()} · {formatHijri(new Date(), hijriOffset)}
            </Text>
            <Text style={[typography.largeTitle, { color: colors.label }]}>Anchor</Text>
            <NextPrayerChip />
          </View>
          <Pressable onPress={() => router.push('/search')} hitSlop={10} style={{ paddingBottom: 8 }}>
            <Icon name="magnifyingglass" size={22} color={colors.secondaryLabel} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <QuickAction icon="cart.fill" label="Expense" color={colors.red} onPress={() => setExpenseVisible(true)} />
          <QuickAction icon="checkmark.circle.fill" label="Task" color={colors.blue} onPress={() => setTaskVisible(true)} />
          <QuickAction icon="hands.sparkles.fill" label="Tasbih" color={colors.mint} onPress={() => router.push('/life/tasbih')} />
          <QuickAction icon="book.fill" label="Quran" color={colors.green} onPress={() => router.push('/life/quran')} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <GettingStartedCard />
          <RamadanCard />
          {show('countdown') ? <CountdownCard /> : null}
          {show('verse') ? <VerseCard /> : null}
          {show('water') ? <WaterCard /> : null}
        </View>

        {show('networth') ? (
<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Pressable onPress={() => router.push('/money')}>
            <Card>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Net worth</Text>
              <Text style={[typography.title1, { color: colors.label, marginTop: 4 }]}>{formatMoney(netWorth, currency)}</Text>
              {openDebts.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                  <Icon name="exclamationmark.triangle.fill" size={14} color={colors.orange} />
                  <Text style={[typography.footnote, { color: colors.orange, marginLeft: 4 }]}>
                    {openDebts.length} open debt{openDebts.length > 1 ? 's' : ''}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 28, marginTop: spacing.sm }}>
                {sparkline.map((v, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      marginHorizontal: 1,
                      borderRadius: 2,
                      backgroundColor: colors.blue,
                      opacity: 0.35 + 0.65 * ((v - sparkMin) / sparkRange),
                      height: Math.max(2, ((v - sparkMin) / sparkRange) * 28),
                    }}
                  />
                ))}
              </View>
            </Card>
          </Pressable>
        </View>
        ) : null}

        {show('stats') ? (
<View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md }}>
          <Card style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>This month</Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>{formatMoney(monthSpend, currency)}</Text>
          </Card>
          <Card style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Due today</Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>{todayTasks.length}</Text>
          </Card>
          <Card style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Prayer streak</Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 2 }]}>{prayerStreak}</Text>
          </Card>
        </View>
        ) : null}

        {show('review') ? (
<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Pressable onPress={() => router.push('/review')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconCircle name="chart.line.uptrend.xyaxis" color={colors.purple} size={36} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.headline, { color: colors.label }]}>Weekly review</Text>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Faith, focus and spending over the last 7 days</Text>
              </View>
              <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
            </Card>
          </Pressable>
        </View>
        ) : null}

        {show('prayers') ? (
<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PrayerTracker />
        </View>
        ) : null}

        {show('today') ? (
<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title3, { color: colors.label }]}>Today</Text>
            <Pressable onPress={() => router.push('/tasks')}>
              <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
            </Pressable>
          </View>
          {todayTasks.length === 0 && todayMeetings.length === 0 ? (
            <Card>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Nothing scheduled today. Enjoy the calm.</Text>
            </Card>
          ) : (
            <Card padded={false}>
              {todayMeetings.map((m, i) => (
                <View
                  key={m.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <Icon name="calendar" size={18} color={colors.indigo} />
                  <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{formatTime(m.start_at)}</Text>
                </View>
              ))}
              {todayTasks.slice(0, 5).map((t, i, arr) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  {t.id === topTaskId ? (
                    <Text style={{ fontSize: 16 }}>🐸</Text>
                  ) : (
                    <Icon name="circle" size={18} color={colors.gray3} />
                  )}
                  <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm }]} numberOfLines={1}>
                    {t.title}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>
        ) : null}

        {show('bills') && upcomingBills.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={[typography.title3, { color: colors.label }]}>Upcoming bills</Text>
              <Pressable onPress={() => router.push('/money/subscriptions')}>
                <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
              </Pressable>
            </View>
            <Card padded={false}>
              {upcomingBills.map((rule, i, arr) => (
                <View
                  key={rule.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <IconCircle name={rule.icon} color={rule.color} size={32} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.body, { color: colors.label }]}>{rule.name}</Text>
                    <Text style={[typography.caption1, { color: isOverdue(rule.next_due_date) ? colors.red : colors.secondaryLabel }]}>
                      {formatRelativeDay(rule.next_due_date)}
                    </Text>
                  </View>
                  <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
                    {formatMoney(rule.amount, rule.currency)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        <Pressable onPress={() => setCustomizeVisible(true)} style={{ alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.blue }]}>Customize Home</Text>
        </Pressable>
      </ScrollView>
      <CustomizeHomeSheet visible={customizeVisible} onClose={() => setCustomizeVisible(false)} />
      <AddTransactionSheet visible={expenseVisible} onClose={() => setExpenseVisible(false)} />
      <AddTaskSheet visible={taskVisible} onClose={() => setTaskVisible(false)} />
    </View>
  );
}
