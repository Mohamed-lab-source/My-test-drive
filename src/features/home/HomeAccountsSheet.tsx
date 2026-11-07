import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { Switch } from '../../ui/Switch';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useBalanceFormatter } from '../../ui/useMoney';
import type { Account, AccountType } from '../../db/types';

// Choose which cards and accounts appear on Home and in what order, or
// start a new one.
export function HomeAccountsSheet({
  visible,
  onClose,
  onNew,
}: {
  visible: boolean;
  onClose: () => void;
  onNew: (type: AccountType) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const balance = useBalanceFormatter();
  const accounts = useFinanceStore((s) => s.accounts).filter((a) => !a.is_archived);
  const { homeAccounts, setHomeAccounts, setHomeAccountShown } = useSettingsStore(useShallow((s) => ({ homeAccounts: s.homeAccounts, setHomeAccounts: s.setHomeAccounts, setHomeAccountShown: s.setHomeAccountShown })));
  const allIds = accounts.map((a) => a.id);
  const shownIds = (homeAccounts ?? allIds).filter((id) => allIds.includes(id));

  const moveUp = (id: string) => {
    const i = shownIds.indexOf(id);
    if (i <= 0) return;
    const next = [...shownIds];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setHomeAccounts(next);
  };

  const row = (a: Account, isLast: boolean) => {
    const on = shownIds.includes(a.id);
    const pos = shownIds.indexOf(a.id);
    return (
      <View
        key={a.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: isLast ? 0 : 0.5,
          borderBottomColor: colors.separator,
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={a.icon} size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.body, { color: colors.label }]} numberOfLines={1}>
            {a.name}
            {a.card_last4 && !a.name.includes(a.card_last4) ? <Text style={{ color: colors.secondaryLabel }}> •• {a.card_last4}</Text> : null}
          </Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
            {a.type === 'credit' ? `${balance(Math.max(0, -a.balance), a.currency)} owed` : balance(a.balance, a.currency)}
            {on ? ` · #${pos + 1} on Home` : ''}
          </Text>
        </View>
        {on && pos > 0 ? (
          <Pressable onPress={() => moveUp(a.id)} hitSlop={8} accessibilityLabel={`Move ${a.name} earlier`} style={{ padding: 6, marginRight: 4 }}>
            <Icon name="arrow.up" size={16} color={colors.blue} />
          </Pressable>
        ) : null}
        <Switch value={on} onValueChange={(v) => setHomeAccountShown(a.id, v, allIds)} />
      </View>
    );
  };

  const cards = accounts.filter((a) => a.type === 'credit');
  const others = accounts.filter((a) => a.type !== 'credit');
  const heading = (t: string) => (
    <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 2 }]}>{t}</Text>
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label }]}>Cards & accounts on Home</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
          Switch on the ones you want to see on Home. Use ↑ to change the order.
        </Text>
        {cards.length ? heading('Credit cards') : null}
        {cards.map((a, i) => row(a, i === cards.length - 1))}
        {others.length ? heading('Accounts') : null}
        {others.map((a, i) => row(a, i === others.length - 1))}

        <View style={{ marginTop: spacing.lg }}>
          <Button title="New credit card" icon={<Icon name="creditcard.fill" size={17} color="#FFFFFF" />} onPress={() => onNew('credit')} />
          <View style={{ height: spacing.sm }} />
          <Button
            title="New bank account, wallet or cash"
            icon={<Icon name="building.columns.fill" size={17} color={colors.blue} />}
            variant="secondary"
            onPress={() => onNew('bank')}
          />
        </View>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
          New cards and accounts are added to Home automatically.
        </Text>
      </ScrollView>
    </Sheet>
  );
}
