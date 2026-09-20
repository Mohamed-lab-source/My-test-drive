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
import { formatRelativeDay, isOverdue } from '../../src/utils/date';
import { todayKey } from '../../src/db/client';

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
  const { accounts, recurringRules, debts } = useFinanceStore();
  const { tasks } = useProductivityStore();

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
  const todayStr = todayKey();
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && (t.scheduled_date === todayStr || t.status === 'in_progress')),
    [tasks, todayStr]
  );
  const upcomingBills = useMemo(
    () =>
      recurringRules
        .filter((r) => r.is_active && r.type === 'expense')
        .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
        .slice(0, 3),
    [recurringRules]
  );
  const openDebts = debts.filter((d) => d.status !== 'paid');

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{greeting()}</Text>
          <Text style={[typography.largeTitle, { color: colors.label }]}>Amanah</Text>
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
            </Card>
          </Pressable>
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
          {todayTasks.length === 0 ? (
            <Card>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Nothing scheduled today. Enjoy the calm.</Text>
            </Card>
          ) : (
            <Card padded={false}>
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
