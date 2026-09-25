import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
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
import { toMinorUnits } from '../../utils/money';
import type { TransactionType } from '../../db/types';

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
}

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

export function AddTransactionSheet({ visible, onClose }: AddTransactionSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories, addTransaction } = useFinanceStore();
  const currency = useSettingsStore((s) => s.currency);

  const [typeIndex, setTypeIndex] = useState(0);
  const type = TYPES[typeIndex];
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(accounts[1]?.id ?? accounts[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const reset = () => {
    setAmount('');
    setNote('');
    setCategoryId(null);
    setTypeIndex(0);
    setReceiptUri(null);
  };

  const handleSave = async () => {
    if (!canSave || !accountId) return;
    setSaving(true);
    try {
      await addTransaction({
        type,
        amount: toMinorUnits(Number(amount)),
        currency,
        account_id: accountId,
        transfer_to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: type === 'transfer' ? null : categoryId,
        recurring_id: null,
        note: note || null,
        date: new Date().toISOString(),
        receipt_uri: receiptUri,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Add Transaction</Text>

        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl
            options={['Expense', 'Income', 'Transfer']}
            selectedIndex={typeIndex}
            onChange={setTypeIndex}
          />
        </View>

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
          <ChipSelector
            options={accounts.map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }))}
            selectedId={accountId}
            onSelect={setAccountId}
          />
        </View>

        {type === 'transfer' ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
              To account
            </Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelector
                options={accounts.map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }))}
                selectedId={toAccountId}
                onSelect={setToAccountId}
              />
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

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Receipt
        </Text>
        <Pressable
          onPress={pickReceipt}
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
            <Image source={{ uri: receiptUri }} style={{ width: 40, height: 40, borderRadius: 8 }} />
          ) : (
            <Icon name="camera.fill" size={20} color={colors.secondaryLabel} />
          )}
          <Text style={[typography.body, { color: colors.label, marginLeft: spacing.sm }]}>
            {receiptUri ? 'Receipt attached · tap to change' : 'Attach a receipt photo'}
          </Text>
        </Pressable>

        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </Sheet>
  );
}
