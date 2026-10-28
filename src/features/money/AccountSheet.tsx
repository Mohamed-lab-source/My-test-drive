import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { setCardLink } from '../../db/repositories/cardLinks';
import { useSmsStore } from '../../sms/smsStore';
import { Switch } from '../../ui/Switch';
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

export function AccountSheet({
  visible,
  onClose,
  editing,
  initialType,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Account | null;
  // The type a new account starts as, e.g. 'credit' from "New card".
  initialType?: AccountType;
}) {
  const { colors, typography, spacing } = useTheme();
  const baseCurrency = useSettingsStore((s) => s.currency);
  const excludedAccounts = useSettingsStore((s) => s.excludedAccounts);
  const setExcludedAccounts = useSettingsStore((s) => s.setExcludedAccounts);
  const { accounts, addAccount, updateAccount } = useFinanceStore();
  const homeAccounts = useSettingsStore((s) => s.homeAccounts);
  const setHomeAccountShown = useSettingsStore((s) => s.setHomeAccountShown);
  const [onHome, setOnHome] = useState(true);

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
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [apr, setApr] = useState('');
  const [minPct, setMinPct] = useState('');
  const [last4, setLast4] = useState('');
  const isCredit = type === 'credit';

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? initialType ?? 'bank');
    setCurrency(editing?.currency ?? baseCurrency);
    // Credit cards are edited as "amount owed" (a positive number); the
    // stored balance is negative while you owe.
    setBalance(editing ? String(fromMinorUnits(editing.type === 'credit' ? -editing.balance : editing.balance)) : '');
    setLimit(editing?.credit_limit ? String(fromMinorUnits(editing.credit_limit)) : '');
    setStatementDay(editing?.statement_day ? String(editing.statement_day) : '');
    setDueDay(editing?.due_day ? String(editing.due_day) : '');
    setMonthlyLimit(editing?.monthly_limit ? String(fromMinorUnits(editing.monthly_limit)) : '');
    setApr(editing?.apr ? String(editing.apr) : '');
    setMinPct(editing?.min_payment_pct ? String(editing.min_payment_pct) : '');
    setLast4(editing?.card_last4 ?? '');
    setColor(editing?.color ?? accentColors[0]);
    setArchived(!!editing?.is_archived);
    setOnHome(editing ? !homeAccounts || homeAccounts.includes(editing.id) : true);
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
        monthly_limit: Number(monthlyLimit) > 0 ? toMinorUnits(Number(monthlyLimit)) : null,
        apr: isCredit && Number(apr) > 0 ? Number(apr) : null,
        min_payment_pct: isCredit && Number(minPct) > 0 ? Number(minPct) : null,
        card_last4: /^\d{3,4}$/.test(last4.trim()) ? last4.trim() : null,
      };
      let id = editing?.id;
      if (editing) {
        await updateAccount(editing.id, { ...fields, is_archived: archived ? 1 : 0 });
      } else {
        await addAccount({ ...fields, sort_order: accounts.length });
        id = useFinanceStore.getState().accounts.find((a) => a.name === fields.name && a.type === fields.type)?.id;
      }
      // Show it on Home (or not). While Home shows everything, a new account
      // appears there anyway, so only an explicit choice is recorded.
      if (id) {
        const allIds = useFinanceStore.getState().accounts.filter((a) => !a.is_archived).map((a) => a.id);
        const shownNow = !homeAccounts || homeAccounts.includes(id);
        if (onHome !== shownNow) setHomeAccountShown(id, onHome, allIds);
      }
      // Bank SMS charges with these digits are posted to this account.
      if (id && fields.card_last4) {
        await setCardLink(fields.card_last4, id, isCredit ? 'credit' : 'debit');
        await useSmsStore.getState().loadLinks();
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
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <TextField label="Interest rate % / year" placeholder="e.g. 36" keyboardType="decimal-pad" value={apr} onChangeText={setApr} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Minimum payment %" placeholder="e.g. 5" keyboardType="decimal-pad" value={minPct} onChangeText={setMinPct} />
              </View>
            </View>
          </>
        ) : null}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="My monthly limit" placeholder="Optional" keyboardType="decimal-pad" value={monthlyLimit} onChangeText={setMonthlyLimit} />
          </View>
          {type === 'bank' || isCredit ? (
            <View style={{ flex: 1 }}>
              <TextField label="Card last 4 digits" placeholder="e.g. 4521" keyboardType="number-pad" maxLength={4} value={last4} onChangeText={setLast4} />
            </View>
          ) : null}
        </View>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
          Get alerts at 80% and 100% of your own monthly limit for this {isCredit ? 'card' : 'account'}. Card digits match bank SMS charges to it.
        </Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.label }]}>Show on Home</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              {isCredit ? 'See what you owe and what’s available on the main screen' : 'See its balance on the main screen'}
            </Text>
          </View>
          <Switch value={onHome} onValueChange={setOnHome} />
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
