import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, Switch } from 'react-native';
import * as Haptics from '../../../src/utils/haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Button } from '../../../src/ui/Button';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TextField } from '../../../src/ui/TextField';
import { EmptyState } from '../../../src/ui/EmptyState';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { bankName, cardLabel } from '../../../src/sms/banks';
import { discoverBankSenders, type FoundSender } from '../../../src/sms/discover';
import { useSmsStore, smsTargetAccount, syncSmsAlertConfig, accountForImport, creditCardFor, billFor } from '../../../src/sms/smsStore';
import * as linksRepo from '../../../src/db/repositories/cardLinks';
import { guessCategory } from '../../../src/sms/categorize';
import { hasReceivePermission, hasSmsPermission, isSmsReadingAvailable, requestSmsPermission } from '../../../src/sms/native';
import { formatMoney } from '../../../src/utils/money';
import { formatRelativeDay, formatTime, localDateKey } from '../../../src/utils/date';
import type { SmsImport } from '../../../src/db/types';
import { latestReportedBalance } from '../../../src/db/repositories/smsImports';
import * as rulesRepo from '../../../src/db/repositories/merchantRules';
import { SkippedMessagesCard, TestMessageCard } from '../../../src/features/money/SmsTools';

export default function SmsInboxScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories, transactions, recurringRules } = useFinanceStore();
  const {
    smsImportEnabled,
    setSmsImportEnabled,
    smsSenders,
    setSmsSenders,
    setSmsAccountId,
    smsInstantAlerts,
    setSmsInstantAlerts,
    smsAutoAddKnown,
    setSmsAutoAddKnown,
    smsReadCredits,
    setSmsReadCredits,
    smsIgnored,
    setSmsIgnored,
  } = useSettingsStore();
  const { pending, scanning, scan, refresh, add, dismiss, rules, loadRules, links, loadLinks } = useSmsStore();
  const addAccount = useFinanceStore((s) => s.addAccount);
  const [pickedAccount, setPickedAccount] = useState<Record<string, string>>({});
  const [inboxSort, setInboxSort] = useState('new');
  const [showRaw, setShowRaw] = useState<string | null>(null);
  const sortedPending = [...pending].sort((a, b) =>
    inboxSort === 'big' ? b.amount - a.amount : inboxSort === 'old' ? a.sms_date.localeCompare(b.sms_date) : b.sms_date.localeCompare(a.sms_date)
  );
  const accountFor = (p: SmsImport) =>
    accounts.find((a) => a.id === pickedAccount[p.id]) ?? accountForImport(p, accounts, links);

  // One tap to set up a credit card account the first time a credit-card
  // charge or payment shows up, linked to the card's digits.
  const createCardAccount = async (p: SmsImport) => {
    const accountName = `${bankName(p.sender, p.body) ?? 'My'} Credit Card${p.card_last4 ? ` ••${p.card_last4}` : ''}`;
    await addAccount({
      name: accountName,
      type: 'credit',
      currency: p.currency,
      icon: 'creditcard.fill',
      color: '#AF52DE',
      sort_order: accounts.length,
    });
    const created = useFinanceStore.getState().accounts.find((a) => a.type === 'credit' && a.name === accountName);
    if (created && p.card_last4) await linksRepo.setCardLink(p.card_last4, created.id, 'credit');
    await loadLinks();
  };
  const [renaming, setRenaming] = useState<{ id: string; merchant: string; text: string } | null>(null);
  const ruleFor = (merchant: string | null) => (merchant ? rules[rulesRepo.ruleKey(merchant)] : undefined);
  const [sendersInput, setSendersInput] = useState(smsSenders.join(', '));
  const [found, setFound] = useState<FoundSender[] | null>(null);
  const [finding, setFinding] = useState(false);

  // Adds senders to the list and re-reads 90 days so their past charges and
  // cards show up straight away.
  const addSenders = async (names: string[]) => {
    const current = sendersInput.split(',').map((x) => x.trim()).filter(Boolean);
    const next = [...current, ...names.filter((n) => !current.some((c) => c.toLowerCase() === n.toLowerCase()))];
    setSendersInput(next.join(', '));
    setSmsSenders(next);
    syncSmsAlertConfig();
    setFound((f) => (f ? f.filter((x) => !names.includes(x.sender)) : f));
    const n = await scan(90);
    Alert.alert('Added', `${names.join(', ')} added. ${n ? `Found ${n} new alert${n === 1 ? '' : 's'} from the last 90 days.` : 'No new alerts in the last 90 days.'}`);
  };
  const findBanks = async () => {
    setFinding(true);
    try {
      setFound(await discoverBankSenders(sendersInput.split(',').map((x) => x.trim()).filter(Boolean)));
    } finally {
      setFinding(false);
    }
  };
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [permission, setPermission] = useState(hasSmsPermission());
  const [receiveGranted, setReceiveGranted] = useState(hasReceivePermission());

  const [bankBalance, setBankBalance] = useState<{ amount: number; currency: string; date: string } | null>(null);
  useEffect(() => {
    refresh();
    loadRules();
    loadLinks();
  }, [refresh, loadRules, loadLinks]);
  useEffect(() => {
    latestReportedBalance().then(setBankBalance);
  }, [pending]);
  const updateAccount = useFinanceStore((s) => s.updateAccount);

  const account = smsTargetAccount(accounts);
  const expenseCats = categories.filter((c) => c.kind !== 'income' && !c.is_archived);
  const guesses = useMemo(
    () =>
      Object.fromEntries(
        pending.map((p) => [p.id, p.kind === 'credit' ? null : guessCategory(p.merchant, categories, transactions)])
      ),
    [pending, categories, transactions]
  );
  const categoryFor = (p: SmsImport) =>
    p.id in picked ? picked[p.id] : ruleFor(p.merchant)?.category_id ?? guesses[p.id];

  const saveRule = async () => {
    if (!renaming || !renaming.text.trim()) return;
    const item = pending.find((x) => x.id === renaming.id);
    await rulesRepo.setMerchantRule(renaming.merchant, renaming.text.trim(), item ? categoryFor(item) ?? null : null);
    await loadRules();
    setRenaming(null);
  };

  // Flags a debit that matches something already logged by hand that day.
  // An entry of the same amount within a day either side — often the same
  // charge logged by hand before the SMS was read.
  const looksLogged = (p: SmsImport) =>
    transactions.find(
      (t) =>
        t.type === (p.kind === 'credit' ? 'income' : 'expense') &&
        t.amount === p.amount &&
        Math.abs(new Date(t.date).getTime() - new Date(p.sms_date).getTime()) <= 36 * 3600000
    ) ?? null;

  const enable = async () => {
    const granted = await requestSmsPermission();
    setPermission(granted);
    if (!granted) {
      Alert.alert('Permission needed', 'Allow SMS access for Anchor in your phone Settings to read bank alerts.');
      return;
    }
    setSmsImportEnabled(true);
    syncSmsAlertConfig();
    const found = await scan();
    Alert.alert('Bank SMS on', found ? `Found ${found} debit${found === 1 ? '' : 's'} from the last 30 days to review.` : 'No debits found in the last 30 days yet. New ones will appear here whenever you open Anchor.');
  };

  const saveSenders = () => {
    const list = sendersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setSmsSenders(list.length ? list : ['HSBC']);
    syncSmsAlertConfig();
  };

  const toggle = (apply: (v: boolean) => void) => (v: boolean) => {
    apply(v);
    syncSmsAlertConfig();
  };

  const handleAdd = async (p: SmsImport, ruleId?: string) => {
    try {
      await add(p, categoryFor(p) ?? null, accountFor(p)?.id ?? null, { ruleId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (e instanceof Error && e.message === 'NO_CREDIT_CARD') {
        Alert.alert('No credit card account', 'Create a credit card account first (tap "Create credit card account" on this item).');
      } else throw e;
    }
  };

  const addAll = () =>
    Alert.alert('Add all', `Add ${pending.length} debit${pending.length === 1 ? '' : 's'} to ${account?.name ?? 'your account'} with the suggested categories?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add all',
        onPress: async () => {
          for (const p of [...pending]) {
            if (p.kind === 'card_payment' && !creditCardFor(p, accounts, links)) continue;
            await add(p, categoryFor(p) ?? null, accountFor(p)?.id ?? null, { silent: true });
          }
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {['CIB', 'NBE', 'BanqueMisr', 'QNB', 'AAIB', 'AlexBank', 'BDC', 'CAE', 'Telda', 'valU', 'ADIB', 'ADCB', 'FAB', 'ENBD', 'Mashreq', 'AlRajhi', 'SNB', 'InstaPay'].map((bank) => {
              const has = sendersInput.toLowerCase().split(',').some((x) => x.trim() === bank.toLowerCase());
              return (
                <Pressable
                  key={bank}
                  disabled={has}
                  onPress={() => {
                    const next = [...sendersInput.split(',').map((x) => x.trim()).filter(Boolean), bank].join(', ');
                    setSendersInput(next);
                    setSmsSenders(next.split(',').map((x) => x.trim()).filter(Boolean));
                    syncSmsAlertConfig();
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    marginRight: 6,
                    marginBottom: 6,
                    backgroundColor: has ? colors.green + '22' : colors.tertiaryFill,
                  }}
                >
                  <Text style={[typography.caption1, { color: has ? colors.green : colors.label }]}>
                    {has ? '✓ ' : '+ '}
                    {bank}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {active ? (
            <View style={{ marginBottom: spacing.md }}>
              <Button title={finding ? 'Looking…' : 'Find my other banks & cards'} variant="secondary" onPress={findBanks} disabled={finding} />
              <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>
                Checks the last 4 months of messages on this phone for card and account alerts from senders you haven't added. Nothing is saved until you add one.
              </Text>
              {found ? (
                found.length === 0 ? (
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>No other banks found — every card alert already comes from a sender on your list.</Text>
                ) : (
                  <View style={{ marginTop: spacing.sm }}>
                    {found.map((f) => (
                      <View key={f.sender} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.body, { color: colors.label }]}>
                            {f.bank && f.bank !== f.sender ? `${f.bank} (${f.sender})` : f.sender}
                          </Text>
                          <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                            {f.alerts} alert{f.alerts === 1 ? '' : 's'}
                            {f.cards.length ? ` · card${f.cards.length === 1 ? '' : 's'} ${f.cards.map((c) => `••${c}`).join(', ')}` : ''}
                            {f.example ? ` · e.g. ${f.example}` : ''}
                          </Text>
                        </View>
                        <Pressable onPress={() => addSenders([f.sender])} hitSlop={8}>
                          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add</Text>
                        </Pressable>
                      </View>
                    ))}
                    {found.length > 1 ? (
                      <Pressable onPress={() => addSenders(found.map((f) => f.sender))} style={{ marginTop: 6 }}>
                        <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add all {found.length}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )
              ) : null}
            </View>
          ) : null}
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Post to</Text>
          <ChipSelector
            options={accounts.filter((a) => !a.is_archived).map((a) => ({ id: a.id, label: a.name, color: a.color }))}
            selectedId={account?.id ?? null}
            onSelect={setSmsAccountId}
          />
          {active ? (
            <>
              {[
                {
                  label: 'Instant alerts',
                  hint: receiveGranted
                    ? 'A notification the moment a debit SMS arrives, even when Anchor is closed'
                    : 'Needs one more permission — tap "Allow alerts" below',
                  value: smsInstantAlerts,
                  onChange: toggle(setSmsInstantAlerts),
                },
                {
                  label: 'Auto-add known merchants',
                  hint: "Skip review for places you've confirmed before, using the same category",
                  value: smsAutoAddKnown,
                  onChange: toggle(setSmsAutoAddKnown),
                },
                {
                  label: 'Also read money in',
                  hint: 'Salary, transfers received and refunds, added as income',
                  value: smsReadCredits,
                  onChange: toggle(setSmsReadCredits),
                },
              ].map((o) => (
                <View key={o.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={[typography.body, { color: colors.label }]}>{o.label}</Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{o.hint}</Text>
                  </View>
                  <Switch value={o.value} onValueChange={o.onChange} />
                </View>
              ))}
                {smsInstantAlerts && !receiveGranted ? (
                <Button
                  title="Allow alerts"
                  variant="secondary"
                  onPress={async () => {
                    await requestSmsPermission();
                    setReceiveGranted(hasReceivePermission());
                    syncSmsAlertConfig();
                    if (!hasReceivePermission()) {
                      Alert.alert(
                        'Permission needed',
                        'Allow SMS for Anchor in Settings → Apps → Anchor → Permissions. If it says "restricted", use ⋮ → Allow restricted settings first.'
                      );
                    }
                  }}
                  style={{ marginTop: spacing.sm }}
                />
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={[typography.body, { color: colors.label }]}>Bank SMS reading</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Turn off to stop scanning and alerts</Text>
                </View>
                <Switch
                  value={smsImportEnabled}
                  onValueChange={(v) => {
                    setSmsImportEnabled(v);
                    syncSmsAlertConfig();
                  }}
                />
              </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <Pressable onPress={() => scan()} disabled={scanning} style={{ marginRight: spacing.lg }}>
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>{scanning ? 'Scanning…' : 'Scan now'}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    saveSenders();
                    const found = await scan(90);
                    Alert.alert('Rescanned', found ? `Found ${found} new debit${found === 1 ? '' : 's'}.` : 'No new debits in the last 90 days.');
                  }}
                  disabled={scanning}
                >
                  <Text style={[typography.subhead, { color: colors.blue }]}>Rescan last 90 days</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Card>

        {active && bankBalance && account && bankBalance.currency === account.currency && pending.length === 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Balance check</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
              Your bank reported {formatMoney(bankBalance.amount, bankBalance.currency)} ({formatRelativeDay(bankBalance.date)}); Anchor shows{' '}
              {formatMoney(account.balance, account.currency)} for {account.name}.
            </Text>
            {bankBalance.amount === account.balance ? (
              <Text style={[typography.subhead, { color: colors.green, marginTop: spacing.xs, fontWeight: '600' }]}>✓ They match</Text>
            ) : (
              <Button
                title={`Set ${account.name} to ${formatMoney(bankBalance.amount, account.currency)}`}
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    'Match the bank?',
                    `This sets ${account.name} to the balance from your bank's latest SMS. Transactions made after that message would need adding again.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Set balance', onPress: () => updateAccount(account.id, { balance: bankBalance.amount }) },
                    ]
                  )
                }
                style={{ marginTop: spacing.sm }}
              />
            )}
          </Card>
        ) : null}

        {active ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[typography.title3, { color: colors.label, flex: 1 }]}>To review ({pending.length})</Text>
              {pending.length > 1 ? (
                <>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Dismiss all?', `Remove ${pending.length} items from the review list without adding them?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Dismiss all',
                          style: 'destructive',
                          onPress: async () => {
                            for (const x of [...pending]) await dismiss(x.id);
                          },
                        },
                      ])
                    }
                    style={{ marginRight: spacing.md }}
                  >
                    <Text style={[typography.subhead, { color: colors.red }]}>Dismiss all</Text>
                  </Pressable>
                  <Pressable onPress={addAll}>
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add all</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
            {pending.length > 1 ? (
              <View style={{ marginBottom: spacing.sm }}>
                <ChipSelector
                  options={[
                    { id: 'new', label: 'Newest first' },
                    { id: 'old', label: 'Oldest first' },
                    { id: 'big', label: 'Largest first' },
                  ]}
                  selectedId={inboxSort}
                  onSelect={setInboxSort}
                />
              </View>
            ) : null}
            {pending.length === 0 ? (
              <Card>
                <EmptyState icon="checkmark.circle.fill" title="All caught up" message="New bank debits show up here whenever you open Anchor." />
              </Card>
            ) : (
              sortedPending.map((p) => {
                const dup = looksLogged(p);
                const target = accountFor(p);
                const foreign = target && p.currency !== target.currency;
                const card = p.kind === 'card_payment' ? creditCardFor(p, accounts, links) : null;
                const needsCardAccount =
                  (p.kind === 'card_payment' && !card) ||
                  (p.card_type === 'credit' && !accounts.some((a) => a.type === 'credit' && !a.is_archived));
                return (
                  <Card key={p.id} style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                          {ruleFor(p.merchant)?.display ??
                            p.merchant ??
                            (p.kind === 'withdrawal' ? 'ATM withdrawal' : p.kind === 'credit' ? 'Money received' : 'Card payment')}
                        </Text>
                        {p.merchant ? (
                          <Text
                            onPress={() => setRenaming({ id: p.id, merchant: p.merchant!, text: ruleFor(p.merchant)?.display ?? '' })}
                            style={[typography.caption1, { color: colors.blue }]}
                          >
                            {ruleFor(p.merchant) ? 'Edit name & category rule' : 'Rename & remember category'}
                          </Text>
                        ) : null}
                        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                          {formatRelativeDay(p.sms_date)} · {formatTime(p.sms_date)} ·{' '}
                          <Text onPress={() => setShowRaw(showRaw === p.id ? null : p.id)} style={{ color: colors.blue }}>
                            {showRaw === p.id ? 'Hide message' : 'Show message'}
                          </Text>
                        </Text>
                        {showRaw === p.id ? (
                          <Text selectable style={[typography.caption1, { color: colors.label, marginTop: 4, padding: 6, borderRadius: 8, backgroundColor: colors.tertiaryFill }]}>
                            {p.body}
                          </Text>
                        ) : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignSelf: 'flex-start',
                            marginTop: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: (p.card_type === 'credit' ? colors.purple : p.card_type === 'debit' ? colors.blue : colors.gray) + '22',
                          }}
                        >
                          <Text
                            style={[
                              typography.caption1,
                              { color: p.card_type === 'credit' ? colors.purple : p.card_type === 'debit' ? colors.blue : colors.secondaryLabel, fontWeight: '600' },
                            ]}
                          >
                            {p.kind === 'card_payment'
                              ? '💳 Credit card payment'
                              : p.card_type === 'credit'
                                ? '💳 Credit card'
                                : p.card_type === 'debit'
                                  ? '🏦 Debit / account'
                                  : '❔ Card type not stated'}
                            {` · ${cardLabel(bankName(p.sender, p.body), p.card_last4)}`}
                          </Text>
                        </View>
                      </View>
                      <Text style={[typography.title3, { color: p.kind === 'credit' ? colors.green : colors.red }]}>
                        {p.kind === 'credit' ? '+' : '−'}
                        {formatMoney(p.amount, p.currency)}
                      </Text>
                    </View>
                    {renaming?.id === p.id ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <TextField
                          placeholder={`Name for "${p.merchant}"`}
                          value={renaming.text}
                          onChangeText={(text) => setRenaming({ ...renaming, text })}
                          autoFocus
                        />
                        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.sm, marginBottom: spacing.sm }]}>
                          Saved with the category picked below; future debits from this merchant use both.
                        </Text>
                        <View style={{ flexDirection: 'row' }}>
                          <Button title="Save rule" onPress={saveRule} disabled={!renaming.text.trim()} style={{ flex: 1, marginRight: spacing.sm }} />
                          <Button title="Cancel" variant="secondary" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
                        </View>
                      </View>
                    ) : null}
                    <Pressable onPress={() => setExpanded(expanded === p.id ? null : p.id)}>
                      <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]} numberOfLines={expanded === p.id ? undefined : 2}>
                        {p.body}
                      </Text>
                    </Pressable>
                    {(() => {
                      const bill = billFor(p, recurringRules);
                      return bill ? (
                        <View style={{ marginTop: 6, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.indigo + '14' }}>
                          <Text style={[typography.caption1, { color: colors.indigo, fontWeight: '600' }]}>
                            📅 Looks like your {bill.name} bill (due {formatRelativeDay(bill.next_due_date)})
                          </Text>
                          <Pressable onPress={() => handleAdd(p, bill.id)} hitSlop={6} style={{ marginTop: 2 }}>
                            <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add & mark bill paid</Text>
                          </Pressable>
                        </View>
                      ) : null;
                    })()}
                    {p.merchant ? (
                      <Pressable
                        onPress={() =>
                          Alert.alert('Ignore this merchant?', `Future bank texts from "${p.merchant}" won't be imported, and pending ones are dismissed.`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Ignore',
                              style: 'destructive',
                              onPress: async () => {
                                const key = p.merchant!.toLowerCase();
                                setSmsIgnored([...smsIgnored.filter((m) => m !== key), key]);
                                for (const x of pending.filter((x) => x.merchant?.toLowerCase() === key)) await dismiss(x.id);
                              },
                            },
                          ])
                        }
                        hitSlop={6}
                        style={{ marginTop: 4 }}
                      >
                        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Always ignore {p.merchant}</Text>
                      </Pressable>
                    ) : null}
                    {dup ? (
                      <View>
                      <Text style={[typography.caption1, { color: colors.orange, marginTop: 4 }]}>
                        Already logged? "{dup.note || 'Untitled'}" ({formatRelativeDay(dup.date)}) has the same amount.
                      </Text>
                      <Pressable onPress={() => dismiss(p.id)} hitSlop={6}>
                        <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Same one — dismiss</Text>
                      </Pressable>
                      </View>
                    ) : null}
                    {foreign ? (
                      <Text style={[typography.caption1, { color: colors.orange, marginTop: 4 }]}>
                        This bank alert is in {p.currency} but {target!.name} is set to {target!.currency}.{' '}
                        <Text
                          style={{ color: colors.blue, fontWeight: '600' }}
                          onPress={() =>
                            Alert.alert(
                              `Use ${p.currency} for ${target!.name}?`,
                              `If this account is really in ${p.currency}, switch it so amounts and balances line up. (Your main currency can be changed in Settings.)`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: `Switch to ${p.currency}`, onPress: () => updateAccount(target!.id, { currency: p.currency }) },
                              ]
                            )
                          }
                        >
                          Switch it to {p.currency}
                        </Text>
                      </Text>
                    ) : null}
                    {needsCardAccount ? (
                      <Button
                        title="Create credit card account"
                        variant="secondary"
                        onPress={() => createCardAccount(p)}
                        style={{ marginTop: spacing.sm }}
                      />
                    ) : null}
                    {p.kind === 'card_payment' && card ? (
                      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
                        Will be added as a transfer from {target?.name ?? 'your bank account'} to {card.name}.
                      </Text>
                    ) : null}
                    <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm, marginBottom: 4 }]}>
                      {p.kind === 'card_payment' ? 'Paid from' : 'Post to'}
                      {p.card_last4 && links[p.card_last4] ? ` · ••${p.card_last4} is linked` : p.card_last4 ? ` · Anchor will remember ••${p.card_last4}` : ''}
                    </Text>
                    <ChipSelector
                      options={accounts
                        .filter((a) => !a.is_archived && (p.kind !== 'card_payment' || a.type !== 'credit'))
                        .map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.type === 'credit' ? 'creditcard.fill' : a.icon }))}
                      selectedId={target?.id ?? null}
                      onSelect={(id) => setPickedAccount((prev) => ({ ...prev, [p.id]: id }))}
                    />
                    {p.kind === 'card_payment' ? null : p.kind === 'credit' ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <ChipSelector
                          options={categories
                            .filter((c) => c.kind !== 'expense' && !c.is_archived)
                            .map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                          selectedId={categoryFor(p) ?? null}
                          onSelect={(id) => setPicked((prev) => ({ ...prev, [p.id]: id }))}
                        />
                      </View>
                    ) : p.kind === 'withdrawal' && accounts.some((a) => a.type === 'cash' && !a.is_archived) ? (
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
        {smsIgnored.length ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>Ignored merchants</Text>
            {smsIgnored.map((m) => (
              <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={[typography.body, { color: colors.label, textTransform: 'capitalize' }]}>{m}</Text>
                <Pressable onPress={() => setSmsIgnored(smsIgnored.filter((x) => x !== m))} hitSlop={6}>
                  <Text style={[typography.subhead, { color: colors.blue }]}>Stop ignoring</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}
        {active ? <SkippedMessagesCard /> : null}
        <TestMessageCard />

        {active && Object.keys(rules).length > 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Merchant rules</Text>
            <Card padded={false}>
              {Object.values(rules).map((r, i, arr) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.label }]}>{r.display}</Text>
                    <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                      {r.id.toUpperCase()}
                      {r.category_id ? ` → ${categories.find((c) => c.id === r.category_id)?.name ?? ''}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      await rulesRepo.deleteMerchantRule(r.id);
                      await loadRules();
                    }}
                    hitSlop={8}
                  >
                    <Text style={[typography.subhead, { color: colors.red }]}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
