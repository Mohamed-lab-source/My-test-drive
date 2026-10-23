import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePullToRefresh } from '../../../src/ui/usePullToRefresh';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import Animated from 'react-native-reanimated';
import { CompactHeader, useScrollY } from '../../../src/ui/CollapsingHeader';
import { PressableScale } from '../../../src/ui/PressableScale';
import { Appear } from '../../../src/ui/Appear';
import { AnimatedNumber } from '../../../src/ui/AnimatedNumber';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { SafeToSpendCard } from '../../../src/features/money/SafeToSpendCard';
import { LastMonthCard } from '../../../src/features/money/LastMonthCard';
import { CardsSummaryCard } from '../../../src/features/money/CardsSummaryCard';
import { WeeklyLimitCard } from '../../../src/features/money/WeeklyLimitCard';
import { SpendingPaceCard } from '../../../src/features/money/SpendingPaceCard';
import { useSmsStore } from '../../../src/sms/smsStore';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { useBalanceFormatter } from '../../../src/ui/useMoney';
import { TextField } from '../../../src/ui/TextField';
import { Icon } from '../../../src/ui/Icon';
import type { Transaction } from '../../../src/db/types';

function QuickLink({ icon, label, color, onPress, badge }: { icon: string; label: string; color: string; onPress: () => void; badge?: number }) {
  const { colors, typography, spacing, radius, shadow } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.93}
      style={[
        {
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors.secondarySystemGroupedBackground,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          paddingVertical: spacing.sm,
          marginHorizontal: 4,
        },
        shadow.card,
      ]}
    >
      <View>
        <IconCircle name={icon} color={color} size={36} filled />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: colors.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '600' }]}>{label}</Text>
    </PressableScale>
  );
}

export default function MoneyScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, transactions, fxRates } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const { netWorthGoal, setNetWorthGoal, hideBalances, setHideBalances } = useSettingsStore();
  const balance = useBalanceFormatter();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const smsPending = useSmsStore((s) => s.pending.length);
  const flaggedCount = useFinanceStore((s) => s.transactions.filter((t) => !!t.flag).length);
  const netWorthHistory = useFinanceStore((s) => s.netWorthHistory);
  const refreshSms = useSmsStore((s) => s.refresh);
  useEffect(() => {
    refreshSms();
  }, [refreshSms]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Opened via the Net worth widget's "+" button (anchor://money?action=add-expense).
  useEffect(() => {
    if (action === 'add-expense') setAddVisible(true);
  }, [action]);

  const excluded = useSettingsStore((s) => s.excludedAccounts);
  const netWorth = accounts.filter((a) => !excluded.includes(a.id)).reduce(
    (sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates),
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={insets.top} />}
      >
        <ScreenHeader scrollY={scrollY} title="Money" />

        <Appear index={0} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typography.subhead, { color: colors.secondaryLabel, flex: 1, fontWeight: '600' }]}>Net worth</Text>
              <Pressable onPress={() => setHideBalances(!hideBalances)} hitSlop={10}>
                <Icon name={hideBalances ? 'eye.slash' : 'eye'} size={18} color={colors.secondaryLabel} />
              </Pressable>
            </View>
            <AnimatedNumber value={netWorth} format={(n) => balance(n, currency)} style={[typography.display, { color: colors.label, marginTop: 4 }]} numberOfLines={1} />
            {(() => {
              // Change since the snapshot closest to a month ago.
              const target = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
              const past = [...netWorthHistory].filter((h) => h.id <= target && h.currency === currency).sort((a, b) => b.id.localeCompare(a.id))[0];
              if (!past || hideBalances) return null;
              const diff = netWorth - past.amount;
              if (diff === 0) return null;
              return (
                <Text style={[typography.footnote, { color: diff > 0 ? colors.green : colors.red }]}>
                  {diff > 0 ? '▲' : '▼'} {formatMoney(Math.abs(diff), currency)} in the last month
                </Text>
              );
            })()}
            {editingGoal ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <TextField placeholder={`Goal in ${currency}`} keyboardType="decimal-pad" value={goalInput} onChangeText={setGoalInput} autoFocus />
                </View>
                <Pressable
                  onPress={() => {
                    setNetWorthGoal(toMinorUnits(Number(goalInput) || 0));
                    setEditingGoal(false);
                  }}
                  style={{ paddingTop: 12 }}
                >
                  <Text style={[typography.headline, { color: colors.blue }]}>Save</Text>
                </Pressable>
              </View>
            ) : netWorthGoal > 0 ? (
              <Pressable
                onPress={() => {
                  setGoalInput(String(fromMinorUnits(netWorthGoal)));
                  setEditingGoal(true);
                }}
                style={{ marginTop: spacing.sm }}
              >
                <ProgressBar progress={Math.max(0, Math.min(1, netWorth / netWorthGoal))} color={colors.green} />
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  {netWorth >= netWorthGoal
                    ? `Goal of ${formatMoney(netWorthGoal, currency)} reached 🎉`
                    : `${Math.round((netWorth / netWorthGoal) * 100)}% of your ${formatMoney(netWorthGoal, currency)} goal · ${formatMoney(netWorthGoal - netWorth, currency)} to go`}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setEditingGoal(true)} style={{ marginTop: 4 }}>
                <Text style={[typography.footnote, { color: colors.blue }]}>Set a net worth goal</Text>
              </Pressable>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              {accounts.filter((a) => !a.is_archived).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push({ pathname: '/money/account/[id]', params: { id: a.id } })}
                  style={{
                    backgroundColor: a.color + '18',
                    borderRadius: 14,
                    padding: spacing.sm,
                    marginRight: spacing.sm,
                    minWidth: 140,
                  }}
                >
                  <IconCircle name={a.icon} color={a.color} size={28} />
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 8 }]}>{a.name}</Text>
                  {a.type === 'credit' ? (
                    <>
                      <Text style={[typography.headline, { color: a.balance < 0 ? colors.red : colors.label }]}>
                        {balance(Math.max(0, -a.balance), a.currency)}
                      </Text>
                      <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
                        owed{a.credit_limit ? ` · ${Math.round((Math.max(0, -a.balance) / a.credit_limit) * 100)}% of limit` : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={[typography.headline, { color: colors.label }]}>{balance(a.balance, a.currency)}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </Appear>

        {smsPending > 0 ? (
          <Pressable onPress={() => router.push('/money/sms-inbox')} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orange + '1F' }}>
              <Icon name="banknote.fill" size={22} color={colors.orange} />
              <Text style={[typography.headline, { color: colors.label, flex: 1, marginLeft: spacing.sm }]}>
                {smsPending} bank debit{smsPending === 1 ? '' : 's'} to review
              </Text>
              <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
            </Card>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <LastMonthCard />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <SafeToSpendCard />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <WeeklyLimitCard />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <SpendingPaceCard />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <CardsSummaryCard />
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <QuickLink icon="exclamationmark.triangle.fill" label="Debts" color={colors.red} onPress={() => router.push('/money/debts')} />
          <QuickLink icon="repeat" label="Subscriptions" color={colors.purple} onPress={() => router.push('/money/subscriptions')} />
          <QuickLink icon="target" label="Savings" color={colors.green} onPress={() => router.push('/money/savings')} />
          <QuickLink icon="calendar" label="Bills" color={colors.indigo} onPress={() => router.push('/money/bills-calendar')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <QuickLink icon="chart.pie.fill" label="Budgets" color={colors.orange} onPress={() => router.push('/money/budgets')} />
          <QuickLink icon="chart.bar.fill" label="Analytics" color={colors.teal} onPress={() => router.push('/money/analytics')} />
          <QuickLink icon="building.columns.fill" label="Accounts" color={colors.blue} onPress={() => router.push('/money/accounts')} />
          <QuickLink icon="hands.sparkles.fill" label="Zakat" color={colors.mint} onPress={() => router.push('/money/zakat')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <QuickLink icon="banknote.fill" label="Bank SMS" color={colors.red} badge={smsPending} onPress={() => router.push('/money/sms-inbox')} />
          <QuickLink icon="creditcard.fill" label="Cards" color={colors.purple} onPress={() => router.push('/money/cards')} />
          <QuickLink icon="cart.badge.plus" label="Shopping" color={colors.green} onPress={() => router.push('/money/shopping')} />
          <QuickLink icon="function" label="Tools" color={colors.gray} onPress={() => router.push('/money/tools')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md }}>
          <QuickLink icon="camera.fill" label="Receipts" color={colors.orange} onPress={() => router.push('/money/receipts')} />
          <QuickLink icon="lightbulb.fill" label="Insights" color={colors.yellow} onPress={() => router.push('/money/insights')} />
          <QuickLink icon="flag.fill" label="Follow-ups" color={colors.red} badge={flaggedCount} onPress={() => router.push('/money/flagged')} />
          <QuickLink icon="trophy.fill" label="Challenges" color={colors.green} onPress={() => router.push('/money/challenges')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md, marginTop: -spacing.sm }}>
          <QuickLink icon="chart.line.uptrend.xyaxis" label="Year" color={colors.indigo} onPress={() => router.push('/money/year')} />
          <View style={{ flex: 3, marginHorizontal: 12 }} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typography.title3, { color: colors.label }]}>Recent activity</Text>
          <Pressable onPress={() => router.push('/money/transactions')}>
            <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {transactions.length === 0 ? (
            <Card>
              <EmptyState icon="banknote" title="No transactions yet" message="Tap + to log your first income or expense." />
            </Card>
          ) : (
            <Card padded={false}>
              {transactions.slice(0, 8).map((tx, i, arr) => (
                <TransactionRow key={tx.id} tx={tx} isLast={i === arr.length - 1} onPress={() => setEditing(tx)} />
              ))}
            </Card>
          )}
        </View>
      </Animated.ScrollView>
      <CompactHeader title="Money" scrollY={scrollY} />

      <FAB onPress={() => setAddVisible(true)} />
      <AddTransactionSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
