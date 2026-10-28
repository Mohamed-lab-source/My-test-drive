import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useBalanceFormatter } from '../../ui/useMoney';
import { GradientCard } from '../../ui/GradientCard';
import { PressableScale } from '../../ui/PressableScale';
import { ActionMenu } from '../../ui/ActionMenu';
import { Icon } from '../../ui/Icon';
import { Card } from '../../ui/Card';
import { shade } from '../../theme/shade';
import { HomeAccountsSheet } from './HomeAccountsSheet';
import { AccountSheet } from '../money/AccountSheet';
import type { Account, AccountType } from '../../db/types';
import { currentMonthStart } from '../../utils/period';

const CARD_W = 188;
const CARD_H = 116;

// The cards and accounts you've chosen, as small Wallet cards in a row, with
// a tile at the end to add more.
export function HomeAccounts() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const balance = useBalanceFormatter();
  const { accounts, transactions } = useFinanceStore();
  const homeAccounts = useSettingsStore((s) => s.homeAccounts);
  const setShown = useSettingsStore((s) => s.setHomeAccountShown);
  const quick = useQuickAddStore((s) => s.open);
  const [editing, setEditing] = useState(false);
  const [menuFor, setMenuFor] = useState<Account | null>(null);
  const [creating, setCreating] = useState<AccountType | null>(null);

  const active = accounts.filter((a) => !a.is_archived);
  const shown = homeAccounts
    ? homeAccounts.map((id) => active.find((a) => a.id === id)).filter((a): a is Account => !!a)
    : active;

  // Spending on each account so far this month.
  const monthSpend = useMemo(() => {
    const now = new Date();
    const start = currentMonthStart(now).getTime();
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.account_id || new Date(t.date).getTime() < start) continue;
      m.set(t.account_id, (m.get(t.account_id) ?? 0) + t.amount);
    }
    return m;
  }, [transactions]);

  const payFrom = active.find((a) => a.type === 'bank')?.id ?? active.find((a) => a.type !== 'credit')?.id;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Text style={[typography.title3, { color: colors.label, flex: 1 }]}>Cards & accounts</Text>
        {active.length ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button">
            <Text style={[typography.subhead, { color: colors.blue }]}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      {active.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="creditcard.fill" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.headline, { color: colors.label }]}>Add your cards and accounts</Text>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>See every balance and card limit right here</Text>
              </View>
              <Icon name="plus.circle.fill" size={24} color={colors.blue} />
            </Card>
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
          {shown.map((a) => {
            const base = /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#007AFF';
            const credit = a.type === 'credit';
            const owed = Math.max(0, -a.balance);
            const limit = a.credit_limit ?? 0;
            const used = credit && limit > 0 ? Math.min(1, owed / limit) : null;
            const spent = monthSpend.get(a.id) ?? 0;
            return (
              <PressableScale
                key={a.id}
                onPress={() => router.push(`/money/account/${a.id}`)}
                onLongPress={() => setMenuFor(a)}
                delayLongPress={350}
                scaleTo={0.96}
                style={{ marginRight: spacing.sm }}
                accessibilityLabel={`${a.name}, ${credit ? `${balance(owed, a.currency)} owed` : balance(a.balance, a.currency)}`}
              >
                <GradientCard colors={[shade(base, 0.12), shade(base, -0.42)]} style={{ width: CARD_W, height: CARD_H, padding: 12, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={a.icon} size={13} color="#FFFFFF" />
                    </View>
                    <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '600', marginLeft: 6, flex: 1 }]} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {a.card_last4 && !a.name.includes(a.card_last4) ? <Text style={[typography.caption2, { color: 'rgba(255,255,255,0.8)' }]}>•• {a.card_last4}</Text> : null}
                  </View>
                  <View>
                    <Text style={[typography.caption2, { color: 'rgba(255,255,255,0.8)' }]}>{credit ? 'Owed' : 'Balance'}</Text>
                    <Text style={[typography.title3, { color: '#FFFFFF', fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit>
                      {balance(credit ? owed : a.balance, a.currency)}
                    </Text>
                  </View>
                  {used !== null ? (
                    <View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                        <View style={{ width: `${used * 100}%`, height: 4, borderRadius: 2, backgroundColor: used >= 0.7 ? '#FFD60A' : '#FFFFFF' }} />
                      </View>
                      <Text style={[typography.caption2, { color: 'rgba(255,255,255,0.85)', marginTop: 3 }]} numberOfLines={1}>
                        {balance(Math.max(0, limit - owed), a.currency)} available
                      </Text>
                    </View>
                  ) : (
                    <Text style={[typography.caption2, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                      {spent > 0 ? `${balance(spent, a.currency)} spent this month` : 'No spending this month'}
                    </Text>
                  )}
                </GradientCard>
              </PressableScale>
            );
          })}
          <PressableScale onPress={() => setEditing(true)} scaleTo={0.96} accessibilityLabel="Add a card or account to Home">
            <View
              style={{
                width: 112,
                height: CARD_H,
                borderRadius: 20,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.separator,
                backgroundColor: colors.tertiaryFill,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
              }}
            >
              <Icon name="plus.circle.fill" size={26} color={colors.blue} />
              <Text style={[typography.footnote, { color: colors.blue, fontWeight: '600', marginTop: 6, textAlign: 'center' }]}>Add card or account</Text>
            </View>
          </PressableScale>
        </ScrollView>
      )}

      <ActionMenu
        visible={!!menuFor}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Open', icon: 'chevron.right', onPress: () => router.push(`/money/account/${menuFor.id}`) },
                { label: 'Add expense', icon: 'arrow.up.circle.fill', onPress: () => quick('expense', menuFor.id), section: true },
                { label: 'Add income', icon: 'arrow.down.circle.fill', onPress: () => quick('income', menuFor.id) },
                { label: 'Transfer from here', icon: 'arrow.left.arrow.right', onPress: () => quick('transfer', menuFor.id) },
                ...(menuFor.type === 'credit' && menuFor.balance < 0 && payFrom
                  ? [
                      {
                        label: `Pay this card (${balance(-menuFor.balance, menuFor.currency)})`,
                        icon: 'creditcard.fill',
                        onPress: () => quick('transfer', payFrom, { toAccountId: menuFor.id, amount: -menuFor.balance }),
                      },
                    ]
                  : []),
                {
                  label: 'Remove from Home',
                  icon: 'minus.circle',
                  section: true,
                  onPress: () => setShown(menuFor.id, false, active.map((a) => a.id)),
                },
              ]
            : []
        }
      />
      <HomeAccountsSheet
        visible={editing}
        onClose={() => setEditing(false)}
        onNew={(type) => {
          setEditing(false);
          setTimeout(() => setCreating(type), 350);
        }}
      />
      <AccountSheet visible={!!creating} initialType={creating ?? undefined} onClose={() => setCreating(null)} />
    </View>
  );
}
