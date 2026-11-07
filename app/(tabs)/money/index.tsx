import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePullToRefresh } from '../../../src/ui/usePullToRefresh';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import Animated from 'react-native-reanimated';
import { AmbientGlow } from '../../../src/ui/AmbientGlow';
import { CompactHeader, useScrollY } from '../../../src/ui/CollapsingHeader';
import { PressableScale } from '../../../src/ui/PressableScale';
import { Appear } from '../../../src/ui/Appear';
import { AnimatedNumber } from '../../../src/ui/AnimatedNumber';
import { WalletStack } from '../../../src/features/money/WalletStack';
import { PlanSummaryCard } from '../../../src/features/money/PlanSummaryCard';
import { WeekSpendCard } from '../../../src/features/money/WeekSpendCard';
import { MoneyMenu } from '../../../src/features/money/MoneyMenu';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { LastMonthCard } from '../../../src/features/money/LastMonthCard';
import { useSmsStore } from '../../../src/sms/smsStore';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { useBalanceFormatter } from '../../../src/ui/useMoney';
import { TextField } from '../../../src/ui/TextField';
import { Icon } from '../../../src/ui/Icon';
import type { Transaction } from '../../../src/db/types';
import { useBudgetStatuses } from '../../../src/features/money/budgets';

const HEADLINE_LABEL = ['Net worth', 'Cash on hand', 'Owed on cards'];

const WALLET_PEEK = 3;

export default function MoneyScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const { refreshing, onRefresh } = usePullToRefresh();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, transactions, fxRates, recurringRules } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, transactions: s.transactions, fxRates: s.fxRates, recurringRules: s.recurringRules })));
  // Day-to-day items without a category, and bills due today or late.
  const uncategorized = transactions.filter((t) => !t.category_id && t.type !== 'transfer').length;
  const billsDue = recurringRules.filter(
    (r) => r.is_active && !r.is_paused && r.type === 'expense' && new Date(r.next_due_date).getTime() < new Date(new Date().setHours(24, 0, 0, 0)).getTime()
  ).length;
  const [addVisible, setAddVisible] = useState(false);
  const { netWorthGoal, setNetWorthGoal, hideBalances, setHideBalances } = useSettingsStore(useShallow((s) => ({ netWorthGoal: s.netWorthGoal, setNetWorthGoal: s.setNetWorthGoal, hideBalances: s.hideBalances, setHideBalances: s.setHideBalances })));
  const balance = useBalanceFormatter();
  const [editingGoal, setEditingGoal] = useState(false);
  const [headline, setHeadline] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const smsPending = useSmsStore((s) => s.pending.length);
  // Budgets already over their limit in their current period.
  const budgetStatuses = useBudgetStatuses();
  const overBudgets = Object.values(budgetStatuses).filter((st) => st.state === 'active' && st.pace === 'over').length;
  const flaggedCount = useFinanceStore((s) => s.transactions.filter((t) => !!t.flag).length);
  // A short wallet by default; the rest are one tap away.
  const [showAllWallet, setShowAllWallet] = useState(false);
  const openAccounts = accounts.filter((a) => !a.is_archived);
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
  const live = accounts.filter((a) => !a.is_archived && !excluded.includes(a.id));
  // Money you can spend right now (bank and cash), and what's owed on cards.
  const cashOnHand = live.filter((a) => a.type === 'bank' || a.type === 'cash').reduce((sum, a) => sum + convertToBase(Math.max(0, a.balance), a.currency, currency, fxRates), 0);
  const cardDebt = live.filter((a) => a.type === 'credit').reduce((sum, a) => sum + convertToBase(Math.max(0, -a.balance), a.currency, currency, fxRates), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <AmbientGlow colors={[colors.green, colors.teal]} />
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
              <Text style={[typography.subhead, { color: colors.secondaryLabel, flex: 1, fontWeight: '600' }]}>{HEADLINE_LABEL[headline]}</Text>
              <Pressable onPress={() => setHideBalances(!hideBalances)} hitSlop={10}>
                <Icon name={hideBalances ? 'eye.slash' : 'eye'} size={18} color={colors.secondaryLabel} />
              </Pressable>
            </View>
            {/* Tap to switch between net worth, cash on hand and card debt. */}
            <Pressable onPress={() => setHeadline((h) => (h + 1) % 3)}>
              <AnimatedNumber
                value={headline === 0 ? netWorth : headline === 1 ? cashOnHand : cardDebt}
                format={(n) => balance(n, currency)}
                style={[typography.display, { color: headline === 2 && cardDebt > 0 ? colors.red : colors.label, marginTop: 4 }]}
                numberOfLines={1}
              />
            </Pressable>
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
          </Card>
        </Appear>

        <Appear index={1} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PlanSummaryCard />
          <View style={{ height: spacing.md }} />
          <WeekSpendCard />
        </Appear>

        {/* Only what needs you right now. */}
        {smsPending || overBudgets || flaggedCount || billsDue || uncategorized ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            {[
              { n: smsPending, label: `bank debit${smsPending === 1 ? '' : 's'} to review`, icon: 'banknote.fill', color: colors.orange, href: '/money/sms-inbox' },
              { n: overBudgets, label: `budget${overBudgets === 1 ? '' : 's'} over`, icon: 'chart.pie.fill', color: colors.red, href: '/money/budgets' },
              { n: flaggedCount, label: `to follow up`, icon: 'flag.fill', color: colors.purple, href: '/money/flagged' },
              { n: billsDue, label: `bill${billsDue === 1 ? '' : 's'} due`, icon: 'calendar', color: colors.red, href: '/money/subscriptions' },
              { n: uncategorized, label: `need${uncategorized === 1 ? 's' : ''} a category`, icon: 'chart.pie.fill', color: colors.blue, href: '/money/uncategorized' },
            ]
              .filter((x) => x.n > 0)
              .map((x) => (
                <PressableScale
                  key={x.href}
                  onPress={() => router.push(x.href as never)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: x.color + '1F', marginRight: 8 }}
                >
                  <Icon name={x.icon} size={16} color={x.color} />
                  <Text style={[typography.subhead, { color: colors.label, marginLeft: 6, fontWeight: '600' }]}>
                    {x.n} {x.label}
                  </Text>
                </PressableScale>
              ))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title2, { color: colors.label }]}>Wallet</Text>
            <View style={{ flexDirection: 'row' }}>
              {openAccounts.length > WALLET_PEEK ? (
                <Pressable onPress={() => setShowAllWallet((v) => !v)} hitSlop={8} style={{ marginRight: spacing.md }}>
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>{showAllWallet ? 'Show less' : `Show all ${openAccounts.length}`}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => router.push('/money/limits')} hitSlop={8}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Limits</Text>
              </Pressable>
            </View>
          </View>
          <WalletStack
            accounts={showAllWallet ? openAccounts : openAccounts.slice(0, WALLET_PEEK)}
            balance={balance}
            onOpen={(a) => router.push({ pathname: '/money/account/[id]', params: { id: a.id } })}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <LastMonthCard />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typography.title3, { color: colors.label }]}>Recent activity</Text>
          <Pressable onPress={() => router.push('/money/transactions')}>
            <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          {transactions.length === 0 ? (
            <Card>
              <EmptyState icon="banknote" title="No transactions yet" message="Tap + to log your first income or expense." />
            </Card>
          ) : (
            <Card padded={false}>
              {transactions.slice(0, 5).map((tx, i, arr) => (
                <TransactionRow key={tx.id} tx={tx} isLast={i === arr.length - 1} onPress={() => setEditing(tx)} />
              ))}
            </Card>
          )}
        </View>

        <MoneyMenu badges={{ budgets: overBudgets, sms: smsPending, flagged: flaggedCount }} />
      </Animated.ScrollView>
      <CompactHeader title="Money" scrollY={scrollY} />

      <FAB onPress={() => setAddVisible(true)} />
      <AddTransactionSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
