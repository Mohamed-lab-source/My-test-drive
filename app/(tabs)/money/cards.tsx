import React, { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { EmptyState } from '../../../src/ui/EmptyState';
import { MiniBars } from '../../../src/ui/MiniBars';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useSmsStore } from '../../../src/sms/smsStore';
import { listSmsImportsSince } from '../../../src/db/repositories/smsImports';
import * as linksRepo from '../../../src/db/repositories/cardLinks';
import { convertToBase } from '../../../src/db/repositories/fx';
import { bankName, cardLabel, cardNetwork } from '../../../src/sms/banks';
import { formatMoney } from '../../../src/utils/money';
import type { SmsImport } from '../../../src/db/types';

const OUT_KINDS = new Set(['purchase', 'debit', 'withdrawal', 'transfer']);
const STATUS_LABEL: Record<string, string> = { added: 'Added', pending: 'To review', dismissed: 'Dismissed' };

interface CardSummary {
  key: string;
  last4: string | null;
  bank: string | null;
  network: string | null;
  type: 'credit' | 'debit' | null;
  items: SmsImport[];
  month: number;
  lastMonth: number;
  total: number;
  count: number;
  lastUsed: SmsImport | null;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const localMonth = (iso: string) => monthKey(new Date(iso));

// Every card and account number seen in your bank alerts, from any bank,
// with what was spent on each, whether or not you've added the charges yet.
export default function CardsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { accounts, fxRates, addAccount } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, fxRates: s.fxRates, addAccount: s.addAccount })));
  const { currency, cardNicknames, setCardNickname } = useSettingsStore(useShallow((s) => ({ currency: s.currency, cardNicknames: s.cardNicknames, setCardNickname: s.setCardNickname })));
  const { links, loadLinks } = useSmsStore(useShallow((s) => ({ links: s.links, loadLinks: s.loadLinks })));
  const [rows, setRows] = useState<SmsImport[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [nickInput, setNickInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      listSmsImportsSince(365).then(setRows);
      loadLinks();
    }, [loadLinks])
  );

  const now = new Date();
  const thisMonth = monthKey(now);
  const prevMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const toBase = (p: SmsImport) => convertToBase(p.amount, p.currency, currency, fxRates);

  const cards = useMemo<CardSummary[]>(() => {
    const groups = new Map<string, SmsImport[]>();
    for (const r of rows) {
      // Alerts without digits are grouped by bank instead.
      const key = r.card_last4 ?? `bank:${bankName(r.sender, r.body) ?? r.sender}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.entries()]
      .map(([key, items]) => {
        const spend = items.filter((i) => OUT_KINDS.has(i.kind) && i.status !== 'dismissed');
        const sum = (xs: SmsImport[]) => xs.reduce((s, i) => s + toBase(i), 0);
        const banks = new Map<string, number>();
        for (const i of items) {
          const b = bankName(i.sender, i.body);
          if (b) banks.set(b, (banks.get(b) ?? 0) + 1);
        }
        const last4 = key.startsWith('bank:') ? null : key;
        const typeVotes = items.map((i) => i.card_type).filter(Boolean);
        const credits = typeVotes.filter((t) => t === 'credit').length;
        return {
          key,
          last4,
          bank: [...banks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          network: items.map((i) => cardNetwork(i.body)).find(Boolean) ?? null,
          type: (last4 && links[last4]?.card_type) || (typeVotes.length ? (credits * 2 >= typeVotes.length ? 'credit' : 'debit') : null),
          items,
          month: sum(spend.filter((i) => localMonth(i.sms_date) === thisMonth)),
          lastMonth: sum(spend.filter((i) => localMonth(i.sms_date) === prevMonth)),
          total: sum(spend),
          count: spend.length,
          lastUsed: spend[0] ?? null,
        } as CardSummary;
      })
      .sort((a, b) => b.month - a.month || b.total - a.total);
  }, [rows, links, fxRates, currency]);

  const name = (c: CardSummary) => (c.last4 && cardNicknames[c.last4]) || cardLabel(c.bank, c.last4);
  const linkedAccount = (c: CardSummary) => (c.last4 ? accounts.find((a) => a.id === links[c.last4!]?.account_id) : undefined);
  const monthTotal = cards.reduce((s, c) => s + c.month, 0);
  const unlinked = cards.filter((c) => c.last4 && !linkedAccount(c)).length;
  const card = cards.find((c) => c.key === selected) ?? null;

  const link = async (c: CardSummary, accountId: string) => {
    if (!c.last4) return;
    const account = accounts.find((a) => a.id === accountId);
    await linksRepo.setCardLink(c.last4, accountId, account?.type === 'credit' ? 'credit' : c.type ?? 'debit');
    await loadLinks();
  };

  // A new account named after the card, linked to it straight away.
  const createAccountFor = (c: CardSummary) => {
    if (!c.last4) return;
    const credit = c.type === 'credit';
    Alert.alert(`Add ${name(c)} as an account?`, credit ? 'Creates a credit card account so its charges and payments track what you owe.' : 'Creates a bank account for the money this card spends from.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add account',
        onPress: async () => {
          const accountName = `${c.bank ?? 'Card'} ${credit ? 'Credit Card' : 'Debit'} ••${c.last4}`;
          await addAccount({
            name: accountName,
            type: credit ? 'credit' : 'bank',
            currency: c.items[0]?.currency ?? currency,
            icon: 'creditcard.fill',
            color: credit ? '#AF52DE' : '#007AFF',
            sort_order: accounts.length,
          });
          const created = useFinanceStore.getState().accounts.find((a) => a.name === accountName);
          if (created) await link(c, created.id);
        },
      },
    ]);
  };

  if (card) {
    const spend = card.items.filter((i) => OUT_KINDS.has(i.kind) && i.status !== 'dismissed');
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const k = monthKey(d);
      return { key: k, label: d.toLocaleDateString(undefined, { month: 'narrow' }), value: spend.filter((s) => localMonth(s.sms_date) === k).reduce((a, s) => a + toBase(s), 0) };
    });
    const merchants = new Map<string, { total: number; count: number }>();
    for (const s of spend) {
      const m = s.merchant ?? (s.kind === 'withdrawal' ? 'ATM withdrawals' : 'Other');
      const e = merchants.get(m) ?? { total: 0, count: 0 };
      merchants.set(m, { total: e.total + toBase(s), count: e.count + 1 });
    }
    const topMerchants = [...merchants.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    const linked = linkedAccount(card);
    const pendingCount = card.items.filter((i) => i.status === 'pending').length;

    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader
          title={name(card)}
          right={
            <Pressable onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue }]}>All cards</Text>
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
              {[card.bank, card.network, card.type ? `${card.type} card` : null, card.last4 ? `ending ${card.last4}` : 'no card number in the alerts'].filter(Boolean).join(' · ')}
            </Text>
            <Text style={[typography.largeTitle, { color: colors.label, marginTop: 4 }]}>{formatMoney(card.month, currency)}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
              this month · {formatMoney(card.lastMonth, currency)} last month · {card.count} charge{card.count === 1 ? '' : 's'} in the last year
            </Text>
            {card.count ? (
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                Average {formatMoney(Math.round(card.total / card.count), currency)} per charge
              </Text>
            ) : null}
            <View style={{ marginTop: spacing.md }}>
              <MiniBars data={months} color={card.type === 'credit' ? colors.purple : colors.blue} />
            </View>
            {pendingCount ? (
              <Pressable onPress={() => router.push('/money/sms-inbox')} style={{ marginTop: spacing.sm }}>
                <Text style={[typography.subhead, { color: colors.orange, fontWeight: '600' }]}>
                  {pendingCount} charge{pendingCount === 1 ? '' : 's'} waiting for review ›
                </Text>
              </Pressable>
            ) : null}
          </Card>

          {card.last4 ? (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.headline, { color: colors.label, marginBottom: 4 }]}>Account</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                {linked ? `Charges on this card are posted to ${linked.name}.` : 'Choose where charges on this card should be posted.'}
              </Text>
              <ChipSelector
                options={accounts.filter((a) => !a.is_archived).map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }))}
                selectedId={linked?.id ?? null}
                onSelect={(id) => link(card, id)}
              />
              {!linked ? <Button title={`Add ${card.type === 'credit' ? 'a credit card' : 'an'} account for it`} variant="secondary" onPress={() => createAccountFor(card)} style={{ marginTop: spacing.sm }} /> : null}
              {linked ? (
                <Pressable
                  onPress={async () => {
                    await linksRepo.deleteCardLink(card.last4!);
                    await loadLinks();
                  }}
                  style={{ marginTop: spacing.sm }}
                >
                  <Text style={[typography.footnote, { color: colors.red }]}>Unlink</Text>
                </Pressable>
              ) : null}
              <View style={{ marginTop: spacing.md }}>
                <TextField
                  label="Nickname"
                  placeholder={cardLabel(card.bank, card.last4)}
                  value={nickInput}
                  onChangeText={setNickInput}
                  onBlur={() => setCardNickname(card.last4!, nickInput)}
                />
              </View>
            </Card>
          ) : null}

          {topMerchants.length ? (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Where it's used most</Text>
              {topMerchants.map(([m, v]) => (
                <View key={m} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                    {m}
                  </Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, marginRight: spacing.sm }]}>×{v.count}</Text>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>{formatMoney(v.total, currency)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Every alert ({card.items.length})
          </Text>
          <Card padded={false}>
            {card.items.map((i, idx) => {
              const out = OUT_KINDS.has(i.kind);
              return (
                <Pressable
                  key={i.id}
                  onPress={() => (i.status === 'pending' ? router.push('/money/sms-inbox') : undefined)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    opacity: i.status === 'dismissed' ? 0.45 : 1,
                    borderBottomWidth: idx === card.items.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.label }]} numberOfLines={1}>
                      {i.merchant ?? (i.kind === 'withdrawal' ? 'ATM withdrawal' : i.kind === 'card_payment' ? 'Card payment' : i.kind === 'credit' ? 'Money in' : 'Card charge')}
                    </Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                      {new Date(i.sms_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {STATUS_LABEL[i.status] ?? i.status}
                    </Text>
                  </View>
                  <Text style={[typography.body, { color: out ? colors.label : colors.green, fontWeight: '600' }]}>
                    {out ? '' : '+'}
                    {formatMoney(i.amount, i.currency)}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Cards" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {cards.length === 0 ? (
          <EmptyState
            icon="creditcard.fill"
            title="No cards yet"
            message="Turn on Bank SMS and add your banks' senders (or tap “Find my other banks”). Every card that shows up in an alert will be listed here."
          />
        ) : (
          <>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Spent across {cards.length} card{cards.length === 1 ? '' : 's'} this month</Text>
              <Text style={[typography.title1, { color: colors.label }]}>{formatMoney(monthTotal, currency)}</Text>
              {unlinked ? (
                <Text style={[typography.footnote, { color: colors.orange, marginTop: 4 }]}>
                  {unlinked} card{unlinked === 1 ? " isn't" : "s aren't"} linked to an account yet — tap one to choose where its charges go.
                </Text>
              ) : null}
            </Card>
            {cards.map((c) => {
              const linked = linkedAccount(c);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setNickInput(c.last4 ? cardNicknames[c.last4] ?? '' : '');
                    setSelected(c.key);
                  }}
                >
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 44,
                          height: 30,
                          borderRadius: 6,
                          marginRight: spacing.sm,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: c.type === 'credit' ? colors.purple : colors.blue,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{c.last4 ?? '••••'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                          {name(c)}
                        </Text>
                        <Text style={[typography.caption1, { color: linked ? colors.secondaryLabel : colors.orange }]} numberOfLines={1}>
                          {[c.type === 'credit' ? 'Credit' : c.type === 'debit' ? 'Debit' : null, c.network, linked ? `→ ${linked.name}` : 'Not linked'].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[typography.headline, { color: colors.label }]}>{formatMoney(c.month, currency)}</Text>
                        <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                          {c.lastUsed ? `last ${new Date(c.lastUsed.sms_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'this month'}
                        </Text>
                      </View>
                    </View>
                    {monthTotal > 0 ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <ProgressBar progress={c.month / monthTotal} color={c.type === 'credit' ? colors.purple : colors.blue} />
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.sm }]}>
              Totals count every card alert from the last year except ones you dismissed, in {currency} at your saved rates.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
