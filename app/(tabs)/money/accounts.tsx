import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { FAB } from '../../../src/ui/FAB';
import { Icon } from '../../../src/ui/Icon';
import { formatMoney } from '../../../src/utils/money';
import { AccountSheet } from '../../../src/features/money/AccountSheet';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { convertToBase } from '../../../src/db/repositories/fx';
import type { Account, AccountType } from '../../../src/db/types';

export default function AccountsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, updateAccount, fxRates } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, updateAccount: s.updateAccount, fxRates: s.fxRates })));
  const currency = useSettingsStore((s) => s.currency);
  const [reordering, setReordering] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

  const open = (account: Account | null) => {
    setEditing(account);
    setSheetVisible(true);
  };

  // Swaps two neighbours, then renumbers everything so sort_order is dense.
  const move = async (list: Account[], index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = [...next, ...accounts.filter((a) => !list.includes(a))];
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].sort_order !== i) await updateAccount(ordered[i].id, { sort_order: i });
    }
  };

  const renderList = (list: Account[]) => (
    <Card padded={false}>
      {list.map((a, i) => (
        <ListRow
          key={a.id}
          isLast={i === list.length - 1}
          leading={<IconCircle name={a.icon} color={a.color} />}
          title={a.name}
          subtitle={`${a.type === 'credit' ? '💳 credit card' : a.type} · ${a.currency}`}
          onPress={reordering ? undefined : () => open(a)}
          trailing={
            reordering ? (
              <View style={{ flexDirection: 'row' }}>
                <Pressable onPress={() => move(list, i, -1)} hitSlop={6} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}>
                  <Icon name="arrow.up" size={20} color={colors.blue} />
                </Pressable>
                <Pressable onPress={() => move(list, i, 1)} hitSlop={6} style={{ padding: 6, opacity: i === list.length - 1 ? 0.3 : 1 }}>
                  <Icon name="arrow.down" size={20} color={colors.blue} />
                </Pressable>
              </View>
            ) : a.type === 'credit' ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.headline, { color: a.balance < 0 ? colors.red : colors.label }]}>{formatMoney(Math.max(0, -a.balance), a.currency)}</Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>owed</Text>
              </View>
            ) : (
              <Text style={[typography.headline, { color: colors.label }]}>{formatMoney(a.balance, a.currency)}</Text>
            )
          }
        />
      ))}
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Accounts"
        right={
          <Pressable onPress={() => setReordering(!reordering)} hitSlop={8}>
            <Text style={[typography.subhead, { color: colors.blue, fontWeight: reordering ? '700' : '400' }]}>{reordering ? 'Done' : 'Order'}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {(() => {
          // Net worth split by kind of account, in your main currency.
          const kinds: { type: AccountType; label: string }[] = [
            { type: 'cash', label: 'Cash' },
            { type: 'wallet', label: 'Wallets' },
            { type: 'bank', label: 'Bank' },
            { type: 'savings', label: 'Savings' },
            { type: 'credit', label: 'Credit cards' },
          ];
          const rows = kinds
            .map((k) => ({ ...k, total: accounts.filter((a) => a.type === k.type).reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0) }))
            .filter((k) => k.total !== 0);
          const net = rows.reduce((sum, k) => sum + k.total, 0);
          const assets = rows.filter((k) => k.total > 0).reduce((sum, k) => sum + k.total, 0);
          if (rows.length === 0) return null;
          return (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Net worth</Text>
              <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.xs }]}>{formatMoney(net, currency)}</Text>
              {rows.map((k) => (
                <View key={k.type} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[typography.subhead, { color: colors.label, width: 100 }]}>{k.label}</Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.tertiaryFill, marginRight: spacing.sm, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.min(100, (Math.abs(k.total) / Math.max(1, assets)) * 100)}%`,
                        height: 6,
                        backgroundColor: k.total < 0 ? colors.red : colors.green,
                      }}
                    />
                  </View>
                  <Text style={[typography.subhead, { color: k.total < 0 ? colors.red : colors.label }]}>{formatMoney(k.total, currency)}</Text>
                </View>
              ))}
            </Card>
          );
        })()}
        {renderList(active)}
        {archived.length > 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Archived</Text>
            {renderList(archived)}
          </>
        ) : null}
      </ScrollView>
      <FAB onPress={() => open(null)} />
      <AccountSheet visible={sheetVisible} editing={editing} onClose={() => setSheetVisible(false)} />
    </View>
  );
}
