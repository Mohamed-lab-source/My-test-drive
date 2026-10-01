import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Button } from '../../../src/ui/Button';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TextField } from '../../../src/ui/TextField';
import { EmptyState } from '../../../src/ui/EmptyState';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useSmsStore, smsTargetAccount } from '../../../src/sms/smsStore';
import { guessCategory } from '../../../src/sms/categorize';
import { hasSmsPermission, isSmsReadingAvailable, requestSmsPermission } from '../../../src/sms/native';
import { formatMoney } from '../../../src/utils/money';
import { formatRelativeDay, formatTime, localDateKey } from '../../../src/utils/date';
import type { SmsImport } from '../../../src/db/types';

export default function SmsInboxScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories, transactions } = useFinanceStore();
  const { smsImportEnabled, setSmsImportEnabled, smsSenders, setSmsSenders, setSmsLastScan, setSmsAccountId } = useSettingsStore();
  const { pending, scanning, scan, refresh, add, dismiss } = useSmsStore();
  const [sendersInput, setSendersInput] = useState(smsSenders.join(', '));
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [permission, setPermission] = useState(hasSmsPermission());

  useEffect(() => {
    refresh();
  }, [refresh]);

  const account = smsTargetAccount(accounts);
  const expenseCats = categories.filter((c) => c.kind !== 'income' && !c.is_archived);
  const guesses = useMemo(
    () => Object.fromEntries(pending.map((p) => [p.id, guessCategory(p.merchant, categories, transactions)])),
    [pending, categories, transactions]
  );
  const categoryFor = (p: SmsImport) => (p.id in picked ? picked[p.id] : guesses[p.id]);

  // Flags a debit that matches something already logged by hand that day.
  const looksLogged = (p: SmsImport) =>
    transactions.some((t) => t.type === 'expense' && t.amount === p.amount && localDateKey(t.date) === localDateKey(p.sms_date));

  const enable = async () => {
    const granted = await requestSmsPermission();
    setPermission(granted);
    if (!granted) {
      Alert.alert('Permission needed', 'Allow SMS access for Anchor in your phone Settings to read bank alerts.');
      return;
    }
    setSmsImportEnabled(true);
    const found = await scan();
    Alert.alert('Bank SMS on', found ? `Found ${found} debit${found === 1 ? '' : 's'} from the last 30 days to review.` : 'No debits found in the last 30 days yet. New ones will appear here whenever you open Anchor.');
  };

  const saveSenders = () => {
    const list = sendersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setSmsSenders(list.length ? list : ['HSBC']);
  };

  const handleAdd = async (p: SmsImport) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await add(p, categoryFor(p) ?? null, account?.id ?? null);
  };

  const addAll = () =>
    Alert.alert('Add all', `Add ${pending.length} debit${pending.length === 1 ? '' : 's'} to ${account?.name ?? 'your account'} with the suggested categories?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add all',
        onPress: async () => {
          for (const p of [...pending]) await add(p, categoryFor(p) ?? null, account?.id ?? null);
        },
      },
    ]);

  if (Platform.OS !== 'android' || !isSmsReadingAvailable()) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Bank SMS" />
        <EmptyState icon="banknote" title="Android only" message="Reading bank SMS needs the Anchor Android app." />
      </View>
    );
  }

  const active = smsImportEnabled && permission;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Bank SMS" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {!active ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Log card spending from your bank's SMS</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4, marginBottom: spacing.md }]}>
              Anchor reads debit alerts only from the senders below, picks out the amount and merchant, and lists them here for
              you to confirm. Messages stay on this phone — they're never synced or backed up, and nothing changes your balances
              until you tap Add.
            </Text>
            <Button title="Turn on" onPress={enable} />
          </Card>
        ) : null}

        <Card style={{ marginBottom: spacing.md }}>
          <TextField
            label="Bank senders"
            placeholder="HSBC"
            value={sendersInput}
            onChangeText={setSendersInput}
            onBlur={saveSenders}
            autoCapitalize="characters"
          />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: -spacing.sm, marginBottom: spacing.sm }]}>
            Comma-separated; matches any SMS sender containing the text (e.g. HSBC, HSBCEG).
          </Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Post to</Text>
          <ChipSelector
            options={accounts.filter((a) => !a.is_archived).map((a) => ({ id: a.id, label: a.name, color: a.color }))}
            selectedId={account?.id ?? null}
            onSelect={setSmsAccountId}
          />
          {active ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              <Pressable onPress={() => scan()} disabled={scanning} style={{ marginRight: spacing.lg }}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>{scanning ? 'Scanning…' : 'Scan now'}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  saveSenders();
                  setSmsLastScan(0);
                  const found = await scan();
                  Alert.alert('Rescanned', found ? `Found ${found} new debit${found === 1 ? '' : 's'}.` : 'No new debits in the last 30 days.');
                }}
                disabled={scanning}
              >
                <Text style={[typography.subhead, { color: colors.blue }]}>Rescan last 30 days</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {active ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[typography.title3, { color: colors.label, flex: 1 }]}>To review ({pending.length})</Text>
              {pending.length > 1 ? (
                <Pressable onPress={addAll}>
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add all</Text>
                </Pressable>
              ) : null}
            </View>
            {pending.length === 0 ? (
              <Card>
                <EmptyState icon="checkmark.circle.fill" title="All caught up" message="New bank debits show up here whenever you open Anchor." />
              </Card>
            ) : (
              pending.map((p) => {
                const dup = looksLogged(p);
                const foreign = account && p.currency !== account.currency;
                return (
                  <Card key={p.id} style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                          {p.merchant ?? (p.kind === 'withdrawal' ? 'ATM withdrawal' : 'Card payment')}
                        </Text>
                        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                          {formatRelativeDay(p.sms_date)} · {formatTime(p.sms_date)}
                          {p.card_last4 ? ` · card •${p.card_last4}` : ''}
                        </Text>
                      </View>
                      <Text style={[typography.title3, { color: colors.red }]}>−{formatMoney(p.amount, p.currency)}</Text>
                    </View>
                    <Pressable onPress={() => setExpanded(expanded === p.id ? null : p.id)}>
                      <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]} numberOfLines={expanded === p.id ? undefined : 2}>
                        {p.body}
                      </Text>
                    </Pressable>
                    {dup ? (
                      <Text style={[typography.caption1, { color: colors.orange, marginTop: 4 }]}>
                        You already logged an expense of this amount that day — dismiss if it's the same one.
                      </Text>
                    ) : null}
                    {foreign ? (
                      <Text style={[typography.caption1, { color: colors.orange, marginTop: 4 }]}>
                        Charged in {p.currency}; your bank may convert it to {account!.currency} — edit the amount after adding if needed.
                      </Text>
                    ) : null}
                    {p.kind === 'withdrawal' && accounts.some((a) => a.type === 'cash' && !a.is_archived) ? (
                      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                        Will be added as a transfer into your Cash account.
                      </Text>
                    ) : (
                      <View style={{ marginTop: spacing.sm }}>
                        <ChipSelector
                          options={expenseCats.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                          selectedId={categoryFor(p) ?? null}
                          onSelect={(id) => setPicked((prev) => ({ ...prev, [p.id]: id }))}
                        />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                      <Button title="Add" onPress={() => handleAdd(p)} style={{ flex: 1, marginRight: spacing.sm }} />
                      <Button title="Dismiss" variant="secondary" onPress={() => dismiss(p.id)} style={{ flex: 1 }} />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
