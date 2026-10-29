import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { ActionMenu } from '../../ui/ActionMenu';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSmsStore } from '../../sms/smsStore';
import { useUndoStore } from '../../store/undoStore';
import { listSmsImportsSince } from '../../db/repositories/smsImports';
import * as linksRepo from '../../db/repositories/cardLinks';
import { bankName, cardLabel, cardNetwork } from '../../sms/banks';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoney } from '../../utils/money';
import type { SmsImport } from '../../db/types';

const OUT = new Set(['purchase', 'debit', 'withdrawal', 'transfer']);

interface Spotted {
  last4: string;
  bank: string | null;
  network: string | null;
  credit: boolean;
  spent: number;
  count: number;
  lastMerchant: string | null;
  currency: string;
}

// Cards seen in your bank alerts that aren't linked to any account yet:
// add one in a tap, link it to an account you have, or say it's not yours.
export function NewCardsPrompt() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, fxRates, addAccount } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, fxRates: s.fxRates, addAccount: s.addAccount })));
  const { currency, ignoredCards, ignoreCard, homeAccounts, setHomeAccountShown } = useSettingsStore(useShallow((s) => ({ currency: s.currency, ignoredCards: s.ignoredCards, ignoreCard: s.ignoreCard, homeAccounts: s.homeAccounts, setHomeAccountShown: s.setHomeAccountShown })));
  const { links, loadLinks, pending } = useSmsStore(useShallow((s) => ({ links: s.links, loadLinks: s.loadLinks, pending: s.pending })));
  const show = useUndoStore((s) => s.show);
  const [rows, setRows] = useState<SmsImport[]>([]);
  const [linking, setLinking] = useState<Spotted | null>(null);

  useEffect(() => {
    listSmsImportsSince(60).then(setRows).catch(() => {});
  }, [pending, links]);

  const spotted = useMemo<Spotted[]>(() => {
    const known = new Set([...Object.keys(links), ...accounts.map((a) => a.card_last4).filter(Boolean)] as string[]);
    const groups = new Map<string, SmsImport[]>();
    for (const r of rows) {
      if (!r.card_last4 || known.has(r.card_last4) || ignoredCards.includes(r.card_last4)) continue;
      groups.set(r.card_last4, [...(groups.get(r.card_last4) ?? []), r]);
    }
    return [...groups.entries()]
      .map(([last4, items]) => {
        const out = items.filter((i) => OUT.has(i.kind) && i.status !== 'dismissed');
        const newest = [...items].sort((a, b) => b.sms_date.localeCompare(a.sms_date))[0];
        return {
          last4,
          bank: bankName(newest.sender, newest.body),
          network: cardNetwork(newest.body),
          credit: items.filter((i) => i.card_type === 'credit').length > items.filter((i) => i.card_type === 'debit').length,
          spent: out.reduce((s, i) => s + convertToBase(i.amount, i.currency, currency, fxRates), 0),
          count: out.length,
          lastMerchant: newest.merchant,
          currency: newest.currency,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [rows, links, accounts, ignoredCards, currency, fxRates]);

  if (!spotted.length) return null;

  const link = async (c: Spotted, accountId: string, credit: boolean) => {
    await linksRepo.setCardLink(c.last4, accountId, credit ? 'credit' : 'debit');
    await loadLinks();
  };

  const add = async (c: Spotted) => {
    const name = `${c.bank ?? 'Card'} ${c.credit ? 'Credit Card' : 'Debit'} ••${c.last4}`;
    await addAccount({
      name,
      type: c.credit ? 'credit' : 'bank',
      currency: c.currency,
      icon: 'creditcard.fill',
      color: c.credit ? '#AF52DE' : '#007AFF',
      sort_order: accounts.length,
      card_last4: c.last4,
    });
    const created = useFinanceStore.getState().accounts.find((a) => a.name === name);
    if (created) {
      await link(c, created.id, c.credit);
      if (homeAccounts && !homeAccounts.includes(created.id)) {
        setHomeAccountShown(created.id, true, useFinanceStore.getState().accounts.map((a) => a.id));
      }
    }
    show(`${cardLabel(c.bank, c.last4)} added`);
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
      {spotted.map((c) => (
        <Card key={c.last4} style={{ marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.blue + '55' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="creditcard.fill" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.caption1, { color: colors.blue, fontWeight: '700', textTransform: 'uppercase' }]}>New card spotted</Text>
              <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                {cardLabel(c.bank, c.last4)}
                {c.network ? <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}> · {c.network}</Text> : null}
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                {c.count ? `${formatMoney(c.spent, currency)} on ${c.count} purchase${c.count === 1 ? '' : 's'}` : 'Seen in your bank alerts'}
                {c.lastMerchant ? ` · last at ${c.lastMerchant}` : ''}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {[
              { label: c.credit ? 'Add credit card' : 'Add card', color: colors.blue, filled: true, onPress: () => add(c) },
              ...(accounts.some((a) => !a.is_archived) ? [{ label: 'Link to…', color: colors.blue, filled: false, onPress: () => setLinking(c) }] : []),
              { label: 'Not mine', color: colors.secondaryLabel, filled: false, onPress: () => ignoreCard(c.last4) },
            ].map((b) => (
              <Pressable
                key={b.label}
                onPress={b.onPress}
                accessibilityRole="button"
                style={{
                  flex: b.filled ? 1.3 : 1,
                  marginRight: 6,
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: b.filled ? b.color : colors.tertiaryFill,
                }}
              >
                <Text style={[typography.subhead, { color: b.filled ? '#FFFFFF' : b.color, fontWeight: '600' }]}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ))}
      <ActionMenu
        visible={!!linking}
        title={linking ? `Which account is ${cardLabel(linking.bank, linking.last4)}?` : undefined}
        onClose={() => setLinking(null)}
        actions={
          linking
            ? accounts
                .filter((a) => !a.is_archived)
                .map((a) => ({
                  label: a.name,
                  icon: a.icon,
                  onPress: async () => {
                    await link(linking, a.id, a.type === 'credit');
                    show(`${cardLabel(linking.bank, linking.last4)} linked to ${a.name}`);
                  },
                }))
            : []
        }
      />
    </View>
  );
}
