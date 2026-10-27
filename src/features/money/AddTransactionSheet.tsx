import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Sheet } from '../../ui/Sheet';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSpendingPlan } from './plan';
import * as Haptics from '../../utils/haptics';
import { useUndoStore } from '../../store/undoStore';
import { useSettingsStore } from '../../store/settingsStore';
import { evalAmount, formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { frequentTransactions, type FrequentTemplate } from '../../utils/frequent';
import { guessCategory } from '../../sms/categorize';
import { todayKey } from '../../db/client';
import type { Transaction, TransactionFlag, TransactionType } from '../../db/types';

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  // For a new transaction: start on this type / account.
  initialType?: TransactionType;
  initialAccountId?: string;
  initialToAccountId?: string;
  initialAmount?: number; // minor units
  initialNote?: string;
}

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

export function AddTransactionSheet({ visible, onClose, editing, initialType, initialAccountId, initialToAccountId, initialAmount, initialNote }: AddTransactionSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { accounts, categories, transactions, addTransaction, updateTransaction, addDebt, addRecurringRule } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);
  const defaultAccountId = useSettingsStore((s) => s.defaultAccountId);

  const [typeIndex, setTypeIndex] = useState(0);
  const type = TYPES[typeIndex];
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [splitWith, setSplitWith] = useState('');
  const [instalments, setInstalments] = useState(1);
  const [flag, setFlag] = useState<TransactionFlag | null>(null);
  const [splitCat, setSplitCat] = useState<string | null>(null);
  const [splitAmount, setSplitAmount] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  // YYYY-MM-DD; today by default. Kept separate from the time of day.
  const [dateKey, setDateKey] = useState(todayKey());
  const [dateInput, setDateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const frequent = useMemo(() => (editing ? [] : frequentTransactions(transactions)), [transactions, editing]);

  const applyTemplate = (t: FrequentTemplate) => {
    setTypeIndex(TYPES.indexOf(t.type));
    setAmount(String(fromMinorUnits(t.amount)));
    setCategoryId(t.categoryId);
    if (accounts.some((a) => a.id === t.accountId && !a.is_archived)) setAccountId(t.accountId);
    setNote(t.note ?? '');
  };

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.is_archived || a.id === editing?.account_id || a.id === editing?.transfer_to_account_id),
    [accounts, editing]
  );

  // Prefill from the transaction being edited, or reset to defaults for a new one.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTypeIndex(TYPES.indexOf(editing.type));
      setAmount(String(fromMinorUnits(editing.amount)));
      setAccountId(editing.account_id);
      setToAccountId(editing.transfer_to_account_id);
      setCategoryId(editing.category_id);
      setNote(editing.note ?? '');
      setReceiptUri(editing.receipt_uri);
      setDateKey(todayKey(new Date(editing.date)));
    } else {
      setTypeIndex(initialType ? TYPES.indexOf(initialType) : 0);
      setAmount(initialAmount ? String(fromMinorUnits(initialAmount)) : '');
      setDateKey(todayKey());
      const from =
        activeAccounts.find((a) => a.id === initialAccountId)?.id ??
        activeAccounts.find((a) => a.id === defaultAccountId)?.id ??
        activeAccounts.find((a) => a.id === useSettingsStore.getState().lastTxAccountId)?.id ??
        activeAccounts[0]?.id ??
        null;
      setAccountId(from);
      setToAccountId(activeAccounts.find((a) => a.id === initialToAccountId && a.id !== from)?.id ?? activeAccounts.find((a) => a.id !== from)?.id ?? from);
      setCategoryId(null);
      setNote(initialNote ?? '');
      setReceiptUri(null);
    }
    setDateInput('');
    setSplitWith('');
    setInstalments(1);
    setFlag(editing?.flag ?? null);
    setSplitCat(null);
    setSplitAmount('');
  }, [visible, editing?.id]);

  // Typed amounts may be sums like "120+45.5".
  const amountValue = evalAmount(amount);
  const plan = useSpendingPlan();
  // The last amount spent at the merchant typed in the note.
  const lastAtMerchant = useMemo(() => {
    const n = note.trim().toLowerCase();
    if (n.length < 3) return null;
    return transactions.find((t) => t.type === type && t.note?.trim().toLowerCase() === n) ?? null;
  }, [note, transactions, type]);
  const isExpression = /[+\-*/×÷]/.test(amount.replace(/^-/, ''));
  const splitNames = splitWith
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const splitShare = splitNames.length > 0 ? Math.round(toMinorUnits(amountValue || 0) / (splitNames.length + 1)) : 0;

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) setReceiptUri(result.assets[0].uri);
  };

  const relevantCategories = useMemo(
    () => categories.filter((c) => c.kind === 'both' || c.kind === type),
    [categories, type]
  );

  const canSave = amount.length > 0 && !isNaN(amountValue) && amountValue > 0 && accountId;

  // The chosen day, keeping the time of day: now for a new entry dated
  // today, noon for other days, the original time when editing.
  const dateIso = () => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const base = editing ? new Date(editing.date) : new Date();
    if (!editing && dateKey === todayKey()) return base.toISOString();
    return new Date(y, m - 1, d, editing ? base.getHours() : 12, editing ? base.getMinutes() : 0).toISOString();
  };

  // Past notes that match what's being typed, newest first.
  const noteSuggestions = useMemo(() => {
    const q = note.trim().toLowerCase();
    if (editing || q.length < 2) return [];
    const seen = new Set<string>();
    const out: Transaction[] = [];
    for (const t of transactions) {
      const n = t.note?.trim();
      if (!n || t.type !== type || n.toLowerCase() === q || !n.toLowerCase().includes(q) || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      out.push(t);
      if (out.length >= 4) break;
    }
    return out;
  }, [note, transactions, type, editing]);

  // A category guess from the note (your history first, then known merchants).
  const suggestedCategory = useMemo(() => {
    if (categoryId || type !== 'expense' || note.trim().length < 3) return null;
    const id = guessCategory(note.trim(), categories, transactions);
    const cat = categories.find((c) => c.id === id);
    return cat && !/^other$/i.test(cat.name) ? cat : null;
  }, [categoryId, type, note, categories, transactions]);

  const handleSave = async (keepOpen = false) => {
    if (!canSave || !accountId) return;
    setSaving(true);
    try {
      const fields = {
        type,
        amount: toMinorUnits(amountValue),
        account_id: accountId,
        transfer_to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: type === 'transfer' ? null : categoryId,
        // An unnamed transfer gets a readable note, e.g. "Bank → Cash".
        note:
          note ||
          (type === 'transfer'
            ? `${accounts.find((a) => a.id === accountId)?.name ?? 'Account'} → ${accounts.find((a) => a.id === toAccountId)?.name ?? 'Account'}`
            : null),
        receipt_uri: receiptUri,
        flag: type === 'transfer' ? null : flag,
      };
      if (editing) {
        await updateTransaction(editing.id, { ...fields, date: dateIso() });
      } else {
        if (type === 'expense' && instalments > 1) {
          // Pay in instalments: the first one now, the rest posted
          // automatically each month by a recurring rule that ends itself.
          const total = fields.amount;
          const each = Math.round(total / instalments);
          const label = note || categories.find((c) => c.id === categoryId)?.name || 'Purchase';
          const now = new Date();
          const first = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9);
          const last = new Date(now.getFullYear(), now.getMonth() + instalments - 1, now.getDate(), 23, 59);
          await addTransaction({ ...fields, amount: each, note: `${label} (1/${instalments})`, currency, recurring_id: null, date: now.toISOString() });
          const cat = categories.find((c) => c.id === categoryId);
          await addRecurringRule({
            name: `${label} — instalment of ${formatMoney(total, currency)}`,
            type: 'expense',
            amount: each,
            currency,
            category_id: categoryId,
            account_id: accountId,
            frequency: 'monthly',
            interval_count: 1,
            start_date: first.toISOString(),
            next_due_date: first.toISOString(),
            end_date: last.toISOString(),
            is_subscription: 0,
            icon: cat?.icon ?? 'creditcard.fill',
            color: cat?.color ?? colors.purple,
            reminder_days_before: 1,
            notes: `${instalments} monthly instalments`,
            auto_post: 1,
          });
          onClose();
          return;
        }
        const newId = await addTransaction({ ...fields, currency, recurring_id: null, date: dateIso() });
        useSettingsStore.getState().setLastTxAccountId(fields.account_id ?? null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useUndoStore
          .getState()
          .show(`${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} of ${formatMoney(fields.amount, currency)} added`, () => {
            useFinanceStore.getState().removeTransaction(newId);
          });
        // You paid the whole bill; each person now owes you an equal share.
        if (type === 'expense') {
          const label = note || categories.find((c) => c.id === categoryId)?.name || 'a shared bill';
          for (const person of splitNames) {
            await addDebt({
              direction: 'owed_to_me',
              person_name: person,
              principal_amount: splitShare,
              currency,
              due_date: null,
              notes: `Split: ${label}`,
            });
          }
        }
      }
      if (keepOpen && !editing) {
        // Ready for the next one: same account, type and date.
        setAmount('');
        setNote('');
        setCategoryId(null);
        setReceiptUri(null);
        setSplitWith('');
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // A one-off that's really a regular bill or income: turn it into a
  // monthly recurring item, next due a month after this one.
  const makeRecurring = async () => {
    if (!editing || editing.type === 'transfer') return;
    const d = new Date(editing.date);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate(), 9);
    const cat = categories.find((c) => c.id === editing.category_id);
    await addRecurringRule({
      name: editing.note || cat?.name || (editing.type === 'income' ? 'Income' : 'Bill'),
      type: editing.type,
      amount: editing.amount,
      currency: editing.currency,
      category_id: editing.category_id,
      account_id: editing.account_id,
      frequency: 'monthly',
      interval_count: 1,
      start_date: next.toISOString(),
      next_due_date: next.toISOString(),
      end_date: null,
      is_subscription: 0,
      icon: cat?.icon ?? 'repeat',
      color: cat?.color ?? colors.purple,
      reminder_days_before: 1,
      notes: null,
    });
    Alert.alert('Now recurring', `Next due ${next.toDateString()}. Manage it in Subscriptions & bills.`);
  };

  const accountOptions = activeAccounts.map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>
          {editing ? 'Edit Transaction' : 'Add Transaction'}
        </Text>

        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Expense', 'Income', 'Transfer']} selectedIndex={typeIndex} onChange={setTypeIndex} />
        </View>

        {frequent.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              Frequent
            </Text>
            <ChipSelector
              options={frequent.map((t) => {
                const cat = categories.find((c) => c.id === t.categoryId);
                return {
                  id: t.key,
                  label: `${t.note ?? cat?.name ?? 'Untitled'} · ${formatMoney(t.amount, currency)}`,
                  color: cat?.color,
                  icon: cat?.icon,
                };
              })}
              selectedId={null}
              onSelect={(id) => {
                const t = frequent.find((f) => f.key === id);
                if (t) applyTemplate(t);
              }}
            />
          </View>
        ) : null}

        <TextField
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          // A big, centred figure, as in Apple Pay.
          style={{ fontSize: 44, fontWeight: '700', height: 84, textAlign: 'center', letterSpacing: -1, fontVariant: ['tabular-nums'] }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -spacing.sm, marginBottom: spacing.md }}>
          {['+', '−', '×', '÷'].map((op) => (
            <Pressable
              key={op}
              onPress={() => setAmount((a) => (a && !/[+\-−×÷*/]$/.test(a) ? a + op : a))}
              style={{ width: 36, height: 30, borderRadius: 8, marginRight: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryFill }}
            >
              <Text style={[typography.headline, { color: colors.label }]}>{op}</Text>
            </Pressable>
          ))}
          {isExpression ? (
            <Text style={[typography.subhead, { color: isNaN(amountValue) ? colors.red : colors.secondaryLabel, marginLeft: 4 }]}>
              {isNaN(amountValue) ? 'Not a valid sum' : `= ${formatMoney(toMinorUnits(amountValue), currency)}`}
            </Text>
          ) : (
            // Tap to add round amounts, like a cash register.
            [10, 50, 100, 500].map((n) => (
              <Pressable
                key={n}
                onPress={() => setAmount((a) => String(Math.round(((Number(a) || 0) + n) * 100) / 100))}
                style={{ paddingHorizontal: 8, height: 30, borderRadius: 8, marginLeft: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue + '18' }}
              >
                <Text style={[typography.footnote, { color: colors.blue, fontWeight: '700' }]}>+{n}</Text>
              </Pressable>
            ))
          )}
        </View>
        {!editing && !amount && lastAtMerchant ? (
          <Pressable onPress={() => setAmount(String(fromMinorUnits(lastAtMerchant.amount)))} style={{ marginTop: -spacing.xs, marginBottom: spacing.sm }}>
            <Text style={[typography.footnote, { color: colors.blue }]}>
              Last time at {lastAtMerchant.note}: {formatMoney(lastAtMerchant.amount, lastAtMerchant.currency)} — tap to use
            </Text>
          </Pressable>
        ) : null}
        {!editing && type === 'expense' && plan && plan.daily.limit > 0 && amountValue > 0 ? (
          <Text
            style={[
              typography.footnote,
              { color: plan.daily.left - toMinorUnits(amountValue) < 0 ? colors.red : colors.secondaryLabel, marginTop: -spacing.xs, marginBottom: spacing.sm },
            ]}
          >
            {plan.daily.left - toMinorUnits(amountValue) >= 0
              ? `Leaves ${formatMoney(plan.daily.left - toMinorUnits(amountValue), currency)} of today's ${formatMoney(plan.daily.limit, currency)}`
              : `Goes ${formatMoney(toMinorUnits(amountValue) - plan.daily.left, currency)} over today's limit`}
          </Text>
        ) : null}

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Date · {dateKey === todayKey() ? 'Today' : new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8))).toDateString()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
          {[0, 1, 2].map((n) => {
            const key = todayKey(new Date(Date.now() - n * 86400000));
            return (
              <Pressable
                key={n}
                onPress={() => setDateKey(key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 14,
                  marginRight: 6,
                  backgroundColor: dateKey === key ? colors.blue : colors.tertiaryFill,
                }}
              >
                <Text style={{ color: dateKey === key ? '#fff' : colors.label, fontWeight: '600' }}>{n === 0 ? 'Today' : n === 1 ? 'Yesterday' : '2 days ago'}</Text>
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="YYYY-MM-DD"
              value={dateInput}
              onChangeText={(v) => {
                setDateInput(v);
                if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime())) setDateKey(v);
              }}
              style={{ height: 34, marginBottom: 0 }}
            />
          </View>
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          {type === 'transfer' ? 'From account' : 'Account'}
        </Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={accountOptions} selectedId={accountId} onSelect={setAccountId} />
        </View>

        {type === 'transfer' ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              To account
            </Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector options={accountOptions} selectedId={toAccountId} onSelect={setToAccountId} />
            </View>
          </>
        ) : (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              Category
            </Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector
                options={relevantCategories.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                selectedId={categoryId}
                onSelect={setCategoryId}
              />
            </View>
          </>
        )}

        <TextField label="Note" placeholder="Optional — add #tags like #travel" value={note} onChangeText={setNote} />
        {noteSuggestions.length || suggestedCategory ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -spacing.sm, marginBottom: spacing.sm }}>
            {noteSuggestions.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setNote(t.note ?? '');
                  if (!categoryId && t.category_id) setCategoryId(t.category_id);
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6, marginBottom: 6, backgroundColor: colors.tertiaryFill }}
              >
                <Text style={[typography.footnote, { color: colors.label }]}>{t.note}</Text>
              </Pressable>
            ))}
            {suggestedCategory ? (
              <Pressable
                onPress={() => setCategoryId(suggestedCategory.id)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6, marginBottom: 6, backgroundColor: suggestedCategory.color + '22' }}
              >
                <Text style={[typography.footnote, { color: suggestedCategory.color, fontWeight: '600' }]}>Category: {suggestedCategory.name}?</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {editing && editing.type === 'expense' && editing.note ? (
          <Pressable
            onPress={() => {
              onClose();
              router.push({ pathname: '/money/merchant', params: { name: editing.note!.replace(/\s*\([A-Z]{3} [\d.,]+\)$/, '').trim() } });
            }}
            style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}
          >
            <Text style={[typography.subhead, { color: colors.blue }]}>Everything at "{editing.note}" ›</Text>
          </Pressable>
        ) : null}

        {!editing && type === 'expense' ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Pay in</Text>
            <View style={{ marginBottom: instalments > 1 ? 4 : spacing.md }}>
              <ChipSelector
                options={[1, 3, 6, 12, 24].map((n) => ({ id: String(n), label: n === 1 ? 'Full' : `${n} months` }))}
                selectedId={String(instalments)}
                onSelect={(id) => setInstalments(Number(id))}
              />
            </View>
            {instalments > 1 && amountValue > 0 ? (
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
                {formatMoney(Math.round(toMinorUnits(amountValue) / instalments), currency)} now and each month for {instalments - 1} more month
                {instalments - 1 === 1 ? '' : 's'} — posted automatically (see Subscriptions & bills).
              </Text>
            ) : null}
            <TextField
              label="Split with"
              placeholder="Names, comma-separated (optional)"
              value={splitWith}
              onChangeText={setSplitWith}
            />
            {splitNames.length > 0 && splitShare > 0 ? (
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
                Each of {splitNames.join(', ')} will owe you {formatMoney(splitShare, currency)} (added to Debts)
              </Text>
            ) : null}
          </>
        ) : null}

        {type !== 'transfer' ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Follow up</Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'review', label: '🚩 Check later' },
                  { id: 'reimburse', label: '💼 Claim back' },
                  { id: 'refund', label: '↩️ Refund due' },
                ]}
                selectedId={flag ?? 'none'}
                onSelect={(id) => setFlag(id === 'none' ? null : (id as TransactionFlag))}
              />
            </View>
          </>
        ) : null}

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Receipt
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.tertiarySystemGroupedBackground,
            borderRadius: 12,
            padding: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          {receiptUri ? (
            <>
              <Pressable onPress={() => setPreviewVisible(true)}>
                <Image source={{ uri: receiptUri }} style={{ width: 40, height: 40, borderRadius: 8 }} />
              </Pressable>
              <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm, flex: 1 }]}>Receipt attached</Text>
              <Pressable onPress={pickReceipt} hitSlop={8} style={{ marginRight: spacing.md }}>
                <Text style={[typography.subhead, { color: colors.blue }]}>Change</Text>
              </Pressable>
              <Pressable onPress={() => setReceiptUri(null)} hitSlop={8}>
                <Text style={[typography.subhead, { color: colors.red }]}>Remove</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={pickReceipt} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="camera.fill" size={20} color={colors.secondaryLabel} />
              <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm }]}>Attach a receipt photo</Text>
            </Pressable>
          )}
        </View>

        {editing && editing.type === 'expense' ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              Split off part into another category
            </Text>
            <ChipSelector
              options={relevantCategories.filter((c) => c.id !== editing.category_id).map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
              selectedId={splitCat}
              onSelect={setSplitCat}
            />
            {splitCat ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <TextField placeholder="Amount to move" keyboardType="decimal-pad" value={splitAmount} onChangeText={setSplitAmount} />
                </View>
                <Pressable
                  onPress={async () => {
                    // One receipt, two categories: the moved part becomes its own
                    // expense and the original shrinks, so balances don't change.
                    const part = toMinorUnits(evalAmount(splitAmount));
                    if (!(part > 0) || part >= editing.amount) return;
                    await updateTransaction(editing.id, { amount: editing.amount - part });
                    await addTransaction({
                      type: 'expense',
                      amount: part,
                      currency: editing.currency,
                      account_id: editing.account_id,
                      transfer_to_account_id: null,
                      category_id: splitCat,
                      recurring_id: null,
                      note: editing.note,
                      date: editing.date,
                    });
                    setSplitAmount('');
                    setSplitCat(null);
                    onClose();
                  }}
                  style={{ paddingTop: 12 }}
                >
                  <Text style={[typography.headline, { color: colors.blue }]}>Split</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {editing && editing.type !== 'transfer' && !editing.recurring_id ? (
          <Pressable onPress={makeRecurring} style={{ marginBottom: spacing.sm }}>
            <Text style={[typography.subhead, { color: colors.blue }]}>↻ Make this a monthly {editing.type === 'income' ? 'income' : 'bill'}</Text>
          </Pressable>
        ) : null}
        <Button title="Save" onPress={() => handleSave()} disabled={!canSave} loading={saving} style={{ marginTop: spacing.sm }} />
        {!editing && instalments === 1 ? (
          <Button title="Save & add another" variant="secondary" onPress={() => handleSave(true)} disabled={!canSave || saving} style={{ marginTop: spacing.sm }} />
        ) : null}
      </ScrollView>

      {receiptUri ? (
        <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setPreviewVisible(false)}
          >
            <Image source={{ uri: receiptUri }} style={{ width: '90%', height: '70%' }} resizeMode="contain" />
            <Text style={[typography.footnote, { color: '#fff', marginTop: spacing.md }]}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
      ) : null}
    </Sheet>
  );
}
