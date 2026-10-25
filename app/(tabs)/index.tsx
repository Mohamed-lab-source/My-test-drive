import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePullToRefresh } from '../../src/ui/usePullToRefresh';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../src/store/financeStore';
import { useProductivityStore } from '../../src/store/productivityStore';
import { useLifeStore } from '../../src/store/lifeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/ui/Card';
import { IconCircle } from '../../src/ui/IconCircle';
import { Icon } from '../../src/ui/Icon';
import { PrayerTracker } from '../../src/features/life/PrayerTracker';
import { SeasonCountdownCard } from '../../src/features/home/SeasonCountdownCard';
import { MoodCheckinCard } from '../../src/features/home/MoodCheckinCard';
import { NameOfDayCard } from '../../src/features/home/NameOfDayCard';
import { InsightOfDayCard, SpentTodayLine } from '../../src/features/home/InsightOfDayCard';
import { HadithCard } from '../../src/features/home/HadithCard';
import { GratitudeMemoryCard } from '../../src/features/home/GratitudeMemoryCard';
import { QUICK_ACTIONS } from '../../src/features/home/homeCards';
import { RamadanCard } from '../../src/features/home/RamadanCard';
import { VerseCard } from '../../src/features/home/VerseCard';
import { CountdownCard } from '../../src/features/home/CountdownCard';
import { WaterCard } from '../../src/features/home/WaterCard';
import { CustomizeHomeSheet } from '../../src/features/home/CustomizeHomeSheet';
import { NextPrayerChip } from '../../src/features/home/NextPrayerChip';
import { NextMeetingChip } from '../../src/features/home/NextMeetingChip';
import { TodayRingsCard } from '../../src/features/home/TodayRingsCard';
import { FridayCard } from '../../src/features/home/FridayCard';
import { useBalanceFormatter } from '../../src/ui/useMoney';
import { GettingStartedCard } from '../../src/features/home/GettingStartedCard';
import { AddTransactionSheet } from '../../src/features/money/AddTransactionSheet';
import { AddTaskSheet } from '../../src/features/tasks/AddTaskSheet';
import { formatMoney } from '../../src/utils/money';
import { convertToBase } from '../../src/db/repositories/fx';
import { reconstructNetWorthTrend } from '../../src/utils/networth';
import { formatHijri, toHijri } from '../../src/utils/hijri';
import Animated from 'react-native-reanimated';
import { AmbientGlow } from '../../src/ui/AmbientGlow';
import { PressableScale } from '../../src/ui/PressableScale';
import { Appear } from '../../src/ui/Appear';
import { useUndoStore } from '../../src/store/undoStore';
import * as Haptics from '../../src/utils/haptics';
import { AnimatedNumber } from '../../src/ui/AnimatedNumber';
import { GradientCard } from '../../src/ui/GradientCard';
import { Sparkline } from '../../src/ui/Sparkline';
import { CompactHeader, useLargeTitleZoom, useScrollY } from '../../src/ui/CollapsingHeader';
import { heroGradient } from '../../src/theme/shade';
import { Widget } from '../../src/ui/Widget';
import { JumpBackIn } from '../../src/features/home/JumpBackIn';
import { ActivityRings } from '../../src/ui/ActivityRings';
import { useWaterStore } from '../../src/store/waterStore';
import { formatRelativeDay, formatTime, isOverdue, localDateKey } from '../../src/utils/date';
import { todayKey } from '../../src/db/client';

const SPARKLINE_DAYS = 14;

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors, typography, radius, shadow } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.92}
      style={[
        {
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 4,
          paddingVertical: 12,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: colors.secondarySystemGroupedBackground,
        },
        shadow.card,
      ]}
    >
      <IconCircle name={icon} color={color} size={38} filled />
      <Text style={[typography.caption1, { color: colors.label, marginTop: 7, fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const todayLine = (offset: number) =>
  `${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · ${formatHijri(new Date(), offset)}`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// A greeting for the day's occasion, if there is one.
function occasionGreeting(offset: number): string | null {
  const now = new Date();
  const h = toHijri(now, offset);
  if (h.month === 10 && h.day <= 3) return 'Eid Mubarak! 🌙';
  if (h.month === 12 && h.day >= 10 && h.day <= 13) return 'Eid al-Adha Mubarak! 🐑';
  if (h.month === 12 && h.day === 9) return 'The Day of Arafah 🤲';
  if (h.month === 1 && h.day === 1) return `Happy new Hijri year ${h.year} 🌙`;
  if (h.month === 9) return 'Ramadan Mubarak 🌙';
  if (now.getDay() === 5) return "Jumu'ah Mubarak 🕌";
  return null;
}

export default function HomeScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const zoom = useLargeTitleZoom(scrollY);
  const accent = colors.blue;
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);
  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [taskVisible, setTaskVisible] = useState(false);
  const [incomeVisible, setIncomeVisible] = useState(false);
  const quickActionIds = useSettingsStore((s) => s.homeQuickActions);
  const displayName = useSettingsStore((s) => s.displayName);
  const quickActions = quickActionIds.map((id) => QUICK_ACTIONS.find((q) => q.id === id)).filter(Boolean).slice(0, 4) as typeof QUICK_ACTIONS;
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const hiddenHomeCards = useSettingsStore((s) => s.hiddenHomeCards);
  const show = (id: string) => !hiddenHomeCards.includes(id);
  const balance = useBalanceFormatter();
  const { accounts, transactions, recurringRules, debts, fxRates, netWorthHistory, postRecurring } = useFinanceStore();
  const { tasks, meetings } = useProductivityStore();
  const prayerStreak = useLifeStore((s) => s.prayerStreak);
  const prayersToday = useLifeStore((s) => s.todayPrayerLogs.filter((l) => l.completed).length);
  const water = useWaterStore((s) => s.count);
  const waterGoal = useSettingsStore((s) => s.waterGoal);

  const excluded = useSettingsStore((s) => s.excludedAccounts);
  const netWorth = accounts.filter((a) => !excluded.includes(a.id)).reduce(
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

  const tasksDoneToday = tasks.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === todayStr).length;
  const todaySpend = transactions
    .filter((t) => t.type === 'expense' && localDateKey(t.date) === todayStr)
    .reduce((sum, t) => sum + convertToBase(t.amount, t.currency, currency, fxRates), 0);
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

  const sparkChange = sparkline.length > 1 ? sparkline[sparkline.length - 1] - sparkline[0] : 0;
  const heroCard = show('networth') ? (
    <Appear index={2} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <PressableScale onPress={() => router.push('/money')} scaleTo={0.98}>
        <GradientCard colors={heroGradient(accent)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[typography.subhead, { color: 'rgba(255,255,255,0.85)', fontWeight: '600', flex: 1 }]}>Net worth</Text>
            {sparkChange !== 0 ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={[typography.caption1, { color: '#fff', fontWeight: '700' }]}>
                  {sparkChange > 0 ? '▲' : '▼'} {balance(Math.abs(sparkChange), currency)} · 2 wks
                </Text>
              </View>
            ) : null}
          </View>
          <AnimatedNumber value={netWorth} format={(n) => balance(n, currency)} style={[typography.display, { color: '#fff', marginTop: 4 }]} numberOfLines={1} />
          <View style={{ marginTop: spacing.sm, marginHorizontal: -4 }}>
            <Sparkline values={sparkline} color="#FFFFFF" height={46} />
          </View>
          {openDebts.length > 0 ? (
            <Text style={[typography.footnote, { color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }]}>
              {openDebts.length} open debt{openDebts.length > 1 ? 's' : ''} · this month {balance(monthSpend, currency)} spent
            </Text>
          ) : (
            <Text style={[typography.footnote, { color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }]}>This month {balance(monthSpend, currency)} spent</Text>
          )}
        </GradientCard>
      </PressableScale>
    </Appear>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <AmbientGlow colors={[colors.blue, colors.purple]} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={insets.top} />}
      >
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
          <Animated.View style={[{ flex: 1, transformOrigin: 'left bottom' }, zoom]}>
            <Pressable onPress={() => router.push('/life/hijri-calendar')} hitSlop={6}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.4 }]} numberOfLines={1}>
                {todayLine(hijriOffset)}
              </Text>
            </Pressable>
            <Text style={[typography.largeTitle, { color: colors.label }]} numberOfLines={1} adjustsFontSizeToFit>
              {greeting()}
              {displayName.trim() ? `, ${displayName.trim().split(' ')[0]}` : ''}
            </Text>
            {occasionGreeting(hijriOffset) ? (
              <Text style={[typography.subhead, { color: colors.green, fontWeight: '600' }]}>{occasionGreeting(hijriOffset)}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <NextPrayerChip />
              <NextMeetingChip />
            </View>
          </Animated.View>
          <PressableScale
            onPress={() => router.push('/search')}
            hitSlop={10}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryFill, marginBottom: 6 }}
          >
            <Icon name="magnifyingglass" size={19} color={colors.label} />
          </PressableScale>
        </View>

        {heroCard}
        {show('stats') ? (
          <Appear index={3} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', marginBottom: spacing.sm + 2 }}>
              <Widget
                icon="creditcard.fill"
                tint={colors.blue}
                title="Spending"
                value={<AnimatedNumber value={monthSpend} format={(n) => balance(n, currency)} style={[typography.title2, { color: colors.label }]} numberOfLines={1} />}
                caption={`This month · ${balance(todaySpend, currency)} today`}
                onPress={() => router.push('/money/insights')}
              />
              <View style={{ width: spacing.sm + 2 }} />
              <Widget
                icon="moon.stars.fill"
                tint={colors.green}
                title="Prayers"
                value={`${prayersToday}/5`}
                caption={prayerStreak > 0 ? `${prayerStreak}-day streak` : 'Today'}
                accessory={<ActivityRings rings={[{ progress: prayersToday / 5, color: colors.green }]} size={40} stroke={7} />}
                onPress={() => router.push('/life/prayer-times')}
              />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Widget
                icon="checkmark.circle.fill"
                tint={colors.orange}
                title="Tasks"
                value={String(todayTasks.length)}
                caption={todayTasks.length ? `left for today${tasksDoneToday ? ` · ${tasksDoneToday} done` : ''}` : tasksDoneToday ? `All done · ${tasksDoneToday} finished` : 'Nothing due today'}
                onPress={() => router.push('/tasks')}
              />
              <View style={{ width: spacing.sm + 2 }} />
              <Widget
                icon="drop.fill"
                tint={colors.cyan}
                title="Water"
                value={`${water}/${waterGoal}`}
                caption="glasses today"
                accessory={<ActivityRings rings={[{ progress: water / Math.max(1, waterGoal), color: colors.cyan }]} size={40} stroke={7} />}
                onPress={() => router.push('/life/health')}
              />
            </View>
          </Appear>
        ) : null}

        <Appear index={4}>
          <JumpBackIn />
        </Appear>
        <Appear index={4} style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md }}>
          {quickActions.map((a) => (
            <QuickAction
              key={a.id}
              icon={a.icon}
              label={a.label}
              color={(colors as unknown as Record<string, string>)[a.color] ?? colors.blue}
              onPress={() =>
                a.id === 'expense'
                  ? setExpenseVisible(true)
                  : a.id === 'income'
                    ? setIncomeVisible(true)
                    : a.id === 'task'
                      ? setTaskVisible(true)
                      : a.route && router.push(a.route as never)
              }
            />
          ))}
        </Appear>
        {show('spent') && !show('stats') ? <SpentTodayLine /> : null}

        <Appear index={5} style={{ paddingHorizontal: spacing.lg }}>
          <GettingStartedCard />
          <RamadanCard />
          {show('seasons') ? <SeasonCountdownCard /> : null}
          {show('rings') && !show('stats') ? <TodayRingsCard /> : null}
          {show('friday') ? <FridayCard /> : null}
          {show('countdown') ? <CountdownCard /> : null}
          {show('mood') ? <MoodCheckinCard /> : null}
          {show('verse') ? <VerseCard /> : null}
          {show('names') ? <NameOfDayCard /> : null}
          {show('hadith') ? <HadithCard /> : null}
          {show('gratitude') ? <GratitudeMemoryCard /> : null}
          {show('insight') ? <InsightOfDayCard /> : null}
          {show('water') ? <WaterCard /> : null}
        </Appear>

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
                // Tap the circle to tick it off right here.
                <Pressable
                  key={t.id}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    useProductivityStore.getState().toggleTaskDone(t.id, true);
                    useUndoStore.getState().show(`Done: ${t.title}`, () => useProductivityStore.getState().toggleTaskDone(t.id, false));
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                    backgroundColor: pressed ? colors.tertiaryFill : 'transparent',
                  })}
                >
                  <Icon name="circle" size={22} color={t.priority === 'high' ? colors.red : colors.gray3} />
                  <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                    {t.id === topTaskId ? '🐸 ' : ''}
                    {t.title}
                  </Text>
                </Pressable>
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
                  <Pressable
                    onPress={() =>
                      Alert.alert(`Pay ${rule.name}?`, `Logs ${formatMoney(rule.amount, rule.currency)} now and moves it to the next due date.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Pay', onPress: () => postRecurring(rule) },
                      ])
                    }
                    hitSlop={8}
                    style={{ marginLeft: spacing.sm, backgroundColor: colors.blue + '1F', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}
                  >
                    <Text style={[typography.footnote, { color: colors.blue, fontWeight: '700' }]}>Pay</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}

        <Pressable onPress={() => setCustomizeVisible(true)} style={{ alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.blue }]}>Customize Home</Text>
        </Pressable>
      </Animated.ScrollView>
      <CompactHeader title="Today" scrollY={scrollY} />
      <CustomizeHomeSheet visible={customizeVisible} onClose={() => setCustomizeVisible(false)} />
      <AddTransactionSheet visible={expenseVisible} onClose={() => setExpenseVisible(false)} />
      <AddTransactionSheet visible={incomeVisible} initialType="income" onClose={() => setIncomeVisible(false)} />
      <AddTaskSheet visible={taskVisible} onClose={() => setTaskVisible(false)} />
    </View>
  );
}
