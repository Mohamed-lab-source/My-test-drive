import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useFinanceStore } from '../../store/financeStore';
import { formatMoney, toMinorUnits } from '../../utils/money';

const NOTES: Record<string, number[]> = {
  EGP: [200, 100, 50, 20, 10, 5, 1, 0.5],
  AED: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  SAR: [500, 200, 100, 50, 10, 5, 1],
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
};

// Count the notes in your wallet and set the Cash account to the total.
export function CashCounter() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, updateAccount, addTransaction, categories } = useFinanceStore();
  const cash = accounts.find((a) => a.type === 'cash' && !a.is_archived);
  const currency = cash?.currency ?? 'EGP';
  const notes = NOTES[currency] ?? NOTES.USD;
  const [counts, setCounts] = useState<Record<number, number>>({});
  const total = notes.reduce((s, n) => s + n * (counts[n] ?? 0), 0);

  const bump = (n: number, d: number) => setCounts((c) => ({ ...c, [n]: Math.max(0, (c[n] ?? 0) + d) }));

  return (
    <Card>
      {notes.map((n) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
          <Text style={[typography.body, { color: colors.label, flex: 1 }]}>
            {n} {currency}
          </Text>
          <Pressable onPress={() => bump(n, -1)} disabled={!counts[n]} hitSlop={8}>
            <Icon name="minus.circle" size={26} color={counts[n] ? colors.blue : colors.gray4} />
          </Pressable>
          <Text style={[typography.headline, { color: colors.label, width: 44, textAlign: 'center' }]}>{counts[n] ?? 0}</Text>
          <Pressable onPress={() => bump(n, 1)} hitSlop={8}>
            <Icon name="plus.circle.fill" size={26} color={colors.blue} />
          </Pressable>
        </View>
      ))}
      <Text style={[typography.title2, { color: colors.label, marginTop: spacing.sm }]}>{formatMoney(toMinorUnits(total), currency)}</Text>
      {cash ? (
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          {cash.name} currently shows {formatMoney(cash.balance, cash.currency)}
        </Text>
      ) : null}
      {cash && total > 0 ? (
        <Button
          title={`Set ${cash.name} to this`}
          variant="secondary"
          onPress={() =>
            Alert.alert('Update cash balance?', `Sets ${cash.name} to ${formatMoney(toMinorUnits(total), currency)}.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Update',
                onPress: async () => {
                  await updateAccount(cash.id, { balance: toMinorUnits(total) });
                  setCounts({});
                },
              },
            ])
          }
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
      {cash && total > 0 && toMinorUnits(total) < cash.balance ? (
        // Cash that vanished without being logged was still spent; record it
        // so it shows up in your spending instead of quietly fixing the balance.
        <Button
          title={`Log ${formatMoney(cash.balance - toMinorUnits(total), currency)} as spending`}
          variant="secondary"
          onPress={async () => {
            await addTransaction({
              type: 'expense',
              amount: cash.balance - toMinorUnits(total),
              currency,
              account_id: cash.id,
              transfer_to_account_id: null,
              category_id: categories.find((c) => /^other$/i.test(c.name))?.id ?? null,
              recurring_id: null,
              note: 'Untracked cash spending',
              date: new Date().toISOString(),
            });
            setCounts({});
          }}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Card>
  );
}
