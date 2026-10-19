import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { accentColors } from '../../theme/colors';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';
import type { Account, AccountType } from '../../db/types';

const TYPES: { id: AccountType; label: string; icon: string }[] = [
  { id: 'cash', label: 'Cash', icon: 'dollarsign.circle.fill' },
  { id: 'bank', label: 'Bank', icon: 'building.columns.fill' },
  { id: 'savings', label: 'Savings', icon: 'banknote.fill' },
  { id: 'credit', label: 'Credit', icon: 'creditcard.fill' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet.pass.fill' },
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'EGP', 'MAD', 'TRY', 'INR', 'PKR', 'MYR', 'IDR'];

export function AccountSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Account | null }) {
  const { colors, typography, spacing } = useTheme();
  const baseCurrency = useSettingsStore((s) => s.currency);
  const excludedAccounts = useSettingsStore((s) => s.excludedAccounts);
  const setExcludedAccounts = useSettingsStore((s) => s.setExcludedAccounts);
  const { accounts, addAccount, updateAccount } = useFinanceStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState(baseCurrency);
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState<string>(accentColors[0]);
  const [archived, setArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const isCredit = type === 'credit';

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'bank');
    setCurrency(editing?.currency ?? baseCurrency);
    // Credit cards are edited as "amount owed" (a positive number); the
    // stored balance is negative while you owe.
    setBalance(editing ? String(fromMinorUnits(editing.type === 'credit' ? -editing.balance : editing.balance)) : '');
    setLimit(editing?.credit_limit ? String(fromMinorUnits(editing.credit_limit)) : '');
    setStatementDay(editing?.statement_day ? String(editing.statement_day) : '');
    setDueDay(editing?.due_day ? String(editing.due_day) : '');
    setColor(editing?.color ?? accentColors[0]);
    setArchived(!!editing?.is_archived);
  }, [visible, editing?.id]);

  const canSave = name.trim().length > 0 && !isNaN(Number(balance || '0'));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const icon = TYPES.find((t) => t.id === type)!.icon;
      const entered = toMinorUnits(Number(balance || '0'));
      const day = (v: string) => {
        const n = Math.round(Number(v));
        return n >= 1 && n <= 31 ? n : null;
      };
      const fields = {
        name: name.trim(),
        type,
        currency,
        icon,
        color,
        balance: isCredit ? -Math.abs(entered) : entered,
        credit_limit: isCredit && Number(limit) > 0 ? toMinorUnits(Number(limit)) : null,
        statement_day: isCredit ? day(statementDay) : null,
        due_day: isCredit ? day(dueDay) : null,
      };
      if (editing) {
        await updateAccount(editing.id, { ...fields, is_archived: archived ? 1 : 0 });
      } else {
        await addAccount({ ...fields, sort_order: accounts.length });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = [typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' as const }];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>
          {editing ? 'Edit Account' : 'New Account'}
        </Text>
        <TextField label="Name" placeholder="e.g. CIB, Wallet, Visa" value={name} onChangeText={setName} />
        <TextField
          label={isCredit ? 'Amount owed now' : editing ? 'Current balance' : 'Starting balance'}
          placeholder="0.00"
          keyboardType="numbers-and-punctuation"
          value={balance}
          onChangeText={setBalance}
        />
        {editing ? (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
            Changing this sets the balance directly (to match your bank), without adding a transaction.
          </Text>
        ) : null}
        <Text style={labelStyle}>Type</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={TYPES} selectedId={type} onSelect={(id) => setType(id as AccountType)} />
        </View>
        {isCredit ? (
          <>
            <TextField label="Credit limit" placeholder="Optional" keyboardType="decimal-pad" value={limit} onChangeText={setLimit} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <TextField label="Statement day" placeholder="e.g. 25" keyboardType="number-pad" value={statementDay} onChangeText={setStatementDay} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Payment due day" placeholder="e.g. 15" keyboardType="number-pad" value={dueDay} onChangeText={setDueDay} />
              </View>
            </View>
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
              Day of the month your statement closes and your payment is due. Used for statements and a payment reminder.
            </Text>
          </>
        ) : null}
        <Text style={labelStyle}>Currency</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={CURRENCIES.map((c) => ({ id: c, label: c }))} selectedId={currency} onSelect={setCurrency} />
        </View>
        <Text style={labelStyle}>Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {accentColors.map((c) => (
            <View
              key={c}
              onTouchEnd={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c,
                marginRight: 10,
                marginBottom: 10,
                borderWidth: c === color ? 3 : 0,
                borderColor: colors.label,
              }}
            />
          ))}
        </View>
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.label }]}>Count in net worth</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Turn off for money that isn't yours, e.g. a work or family account</Text>
            </View>
            <Switch
              value={!excludedAccounts.includes(editing.id)}
              onValueChange={(v) =>
                setExcludedAccounts(v ? excludedAccounts.filter((x) => x !== editing.id) : [...excludedAccounts, editing.id])
              }
            />
          </View>
        ) : null}
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.label }]}>Archived</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Hidden from pickers; still counts in net worth</Text>
            </View>
            <Switch value={archived} onValueChange={setArchived} />
          </View>
        ) : null}
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginBottom: spacing.xl }} />
      </ScrollView>
    </Sheet>
  );
}
