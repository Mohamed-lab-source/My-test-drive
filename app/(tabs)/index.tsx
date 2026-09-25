import React, { useMemo } from 'react';
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
import { formatMoney } from '../../src/utils/money';
import { convertToBase } from '../../src/db/repositories/fx';
import { reconstructNetWorthTrend } from '../../src/utils/networth';
import { formatRelativeDay, formatTime, isOverdue } from '../../src/utils/date';
import { todayKey } from '../../src/db/client';

const SPARKLINE_DAYS = 14;

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
  const { accounts, transactions, recurringRules, debts, fxRates } = useFinanceStore();
  const { tasks, meetings } = useProductivityStore();
  const prayerStreak = useLifeStore((s) => s.prayerStreak);

  const netWorth = accounts.reduce(
    (sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates),
    0
  );
  const todayStr = todayKey();
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress')),
    [tasks, todayStr]
  );
  const todayMeetings = useMemo(
    () => meetings.filter((m) => m.start_at.slice(0, 10) === todayStr),
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
        .filter((t) => t.type === 'expense' && t.date >= monthStart)
        .reduce((sum, t) => sum + convertToBase(t.amount, t.currency, currency, fxRates), 0),
    [transactions, monthStart, currency, fxRates]
  );

  const sparkline = useMemo(
    () => reconstructNetWorthTrend(netWorth, transactions, SPARKLINE_DAYS, currency, fxRates),
    [netWorth, transactions, currency, fxRates]
  );
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
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{greeting()}</Text>
            <Text style={[typography.largeTitle, { color: colors.label }]}>Anchor</Text>
          </View>
          <Pressable onPress={() => router.push('/search')} hitSlop={10} style={{ paddingBottom: 8 }}>
            <Icon name="magnifyingglass" size={22} color={colors.secondaryLabel} />
          </Pressable>
        </View>

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

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PrayerTracker />
        </View>

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
                  <Icon name="circle" size={18} color={colors.gray3} />
                  <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm }]} numberOfLines={1}>
                    {t.title}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>

        {upcomingBills.length > 0 && (
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
      </ScrollView>
    </View>
  );
}
