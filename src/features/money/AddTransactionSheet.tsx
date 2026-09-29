import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Sheet } from '../../ui/Sheet';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { frequentTransactions, type FrequentTemplate } from '../../utils/frequent';
import type { Transaction, TransactionType } from '../../db/types';

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  editing?: Transaction | null;
}

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

export function AddTransactionSheet({ visible, onClose, editing }: AddTransactionSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories, transactions, addTransaction, updateTransaction, addDebt } = useFinanceStore();
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
  const [previewVisible, setPreviewVisible] = useState(false);
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
    } else {
      setTypeIndex(0);
      setAmount('');
      setAccountId(activeAccounts.find((a) => a.id === defaultAccountId)?.id ?? activeAccounts[0]?.id ?? null);
      setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? null);
      setCategoryId(null);
      setNote('');
      setReceiptUri(null);
    }
    setSplitWith('');
  }, [visible, editing?.id]);

  const splitNames = splitWith
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const splitShare = splitNames.length > 0 ? Math.round(toMinorUnits(Number(amount) || 0) / (splitNames.length + 1)) : 0;

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

  const canSave = amount.length > 0 && !isNaN(Number(amount)) && Number(amount) > 0 && accountId;

  const handleSave = async () => {
    if (!canSave || !accountId) return;
    setSaving(true);
    try {
      const fields = {
        type,
        amount: toMinorUnits(Number(amount)),
        account_id: accountId,
        transfer_to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: type === 'transfer' ? null : categoryId,
        note: note || null,
        receipt_uri: receiptUri,
      };
      if (editing) {
        await updateTransaction(editing.id, fields);
      } else {
        await addTransaction({ ...fields, currency, recurring_id: null, date: new Date().toISOString() });
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
      onClose();
    } finally {
      setSaving(false);
    }
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
          style={{ fontSize: 28, fontWeight: '700', height: 60 }}
        />

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

        <TextField label="Note" placeholder="Optional note" value={note} onChangeText={setNote} />

        {!editing && type === 'expense' ? (
          <>
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

        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginTop: spacing.sm }} />
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
