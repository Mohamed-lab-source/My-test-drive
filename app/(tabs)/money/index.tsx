import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { AddTransactionSheet } from '../../../src/features/money/AddTransactionSheet';
import { TransactionRow } from '../../../src/features/money/TransactionRow';
import { SafeToSpendCard } from '../../../src/features/money/SafeToSpendCard';
import { useSmsStore } from '../../../src/sms/smsStore';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { TextField } from '../../../src/ui/TextField';
import { Icon } from '../../../src/ui/Icon';
import type { Transaction } from '../../../src/db/types';

function QuickLink({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.secondarySystemGroupedBackground,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
        marginHorizontal: 4,
      }}
    >
      <IconCircle name={icon} color={color} size={40} />
      <Text style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export default function MoneyScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, transactions, fxRates } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const { netWorthGoal, setNetWorthGoal } = useSettingsStore();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const smsPending = useSmsStore((s) => s.pending.length);
  const refreshSms = useSmsStore((s) => s.refresh);
  useEffect(() => {
    refreshSms();
  }, [refreshSms]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Opened via the Net worth widget's "+" button (anchor://money?action=add-expense).
  useEffect(() => {
    if (action === 'add-expense') setAddVisible(true);
  }, [action]);

  const netWorth = accounts.reduce(
    (sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates),
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader title="Money" />

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Net worth</Text>
            <Text style={[typography.largeTitle, { color: colors.label, marginTop: 4 }]}>
              {formatMoney(netWorth, currency)}
            </Text>
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
                  <Text style={[typography.headline, { color: colors.label }]}>{formatMoney(a.balance, a.currency)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </View>

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

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <SafeToSpendCard />
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
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md }}>
          <QuickLink icon="banknote.fill" label="Bank SMS" color={colors.red} onPress={() => router.push('/money/sms-inbox')} />
          <QuickLink icon="cart.badge.plus" label="Shopping" color={colors.green} onPress={() => router.push('/money/shopping')} />
          <QuickLink icon="function" label="Tools" color={colors.gray} onPress={() => router.push('/money/tools')} />
          <View style={{ flex: 1, marginHorizontal: 4 }} />
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
      </ScrollView>

      <FAB onPress={() => setAddVisible(true)} />
      <AddTransactionSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
