import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { toHijri } from '../../utils/hijri';

// Zakat al-Fitr: one sa' of staple food (about 2.5–3 kg) per person in the
// household, usually paid in cash at the rate your local mosque announces.
export function FitrCard() {
  const { colors, typography, spacing } = useTheme();
  const { currency, fitr, setFitr, defaultAccountId, hijriOffset } = useSettingsStore();
  const { accounts, categories, addTransaction } = useFinanceStore();
  const [rate, setRate] = useState(fitr.perPerson > 0 ? String(fromMinorUnits(fitr.perPerson)) : '');
  const total = fitr.people * fitr.perPerson;
  const inRamadan = toHijri(new Date(), hijriOffset).month === 9;

  const logPaid = () => {
    const account = accounts.find((a) => a.id === defaultAccountId && !a.is_archived) ?? accounts.find((a) => !a.is_archived);
    if (!account || total <= 0) return;
    const cat = categories.find((c) => c.kind !== 'income' && /zakat|charity|sadaqah|donation|صدقة|زكاة/i.test(c.name));
    Alert.alert('Log Zakat al-Fitr', `Add ${formatMoney(total, currency)} as paid from ${account.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: () =>
          addTransaction({
            type: 'expense',
            amount: total,
            currency,
            account_id: account.id,
            transfer_to_account_id: null,
            category_id: cat?.id ?? null,
            recurring_id: null,
            note: `Zakat al-Fitr (${fitr.people} ${fitr.people === 1 ? 'person' : 'people'})`,
            date: new Date().toISOString(),
          }),
      },
    ]);
  };

  const step = (d: number) => setFitr({ ...fitr, people: Math.max(1, Math.min(30, fitr.people + d)) });

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>Zakat al-Fitr</Text>
      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
        {inRamadan ? 'Due before the Eid prayer — ' : ''}one sa&apos; of food per person in your household, or its value.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={[typography.body, { color: colors.label, flex: 1 }]}>People</Text>
        <Pressable onPress={() => step(-1)} hitSlop={8} style={{ paddingHorizontal: spacing.md }}>
          <Text style={[typography.title2, { color: colors.blue }]}>−</Text>
        </Pressable>
        <Text style={[typography.title3, { color: colors.label, minWidth: 28, textAlign: 'center' }]}>{fitr.people}</Text>
        <Pressable onPress={() => step(1)} hitSlop={8} style={{ paddingHorizontal: spacing.md }}>
          <Text style={[typography.title2, { color: colors.blue }]}>+</Text>
        </Pressable>
      </View>
      <TextField
        label={`Amount per person (${currency})`}
        placeholder="The rate announced by your mosque"
        keyboardType="decimal-pad"
        value={rate}
        onChangeText={(v) => {
          setRate(v);
          setFitr({ ...fitr, perPerson: toMinorUnits(Number(v) || 0) });
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[typography.title2, { color: colors.label }]}>{formatMoney(total, currency)}</Text>
        {total > 0 ? (
          <Pressable onPress={logPaid} hitSlop={8}>
            <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Log as paid</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
