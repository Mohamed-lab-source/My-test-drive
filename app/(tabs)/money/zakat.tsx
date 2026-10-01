import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { formatMoney, toMinorUnits } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { SadaqahCard } from '../../../src/features/money/SadaqahCard';

const ZAKAT_RATE = 0.025;

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
      <Text style={[typography.body, { color: colors.secondaryLabel }]}>{label}</Text>
      <Text style={[typography.body, { color: color ?? colors.label, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const NISAB_GOLD_GRAMS = 85;

export default function ZakatScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts, debts, fxRates } = useFinanceStore();
  const { currency, zakatNisab, setZakatNisab, goldPricePerGram, setGoldPricePerGram } = useSettingsStore();
  const [goldInput, setGoldInput] = useState(goldPricePerGram > 0 ? String(goldPricePerGram) : '');

  const [nisabInput, setNisabInput] = useState(zakatNisab > 0 ? String(zakatNisab) : '');
  const [otherAssets, setOtherAssets] = useState('');
  const [includeReceivables, setIncludeReceivables] = useState(true);
  const [deductDebts, setDeductDebts] = useState(true);

  const toBase = (amount: number, cur: string) => convertToBase(amount, cur, currency, fxRates);

  const { cash, receivables, owed } = useMemo(() => {
    const cash = accounts
      .filter((a) => a.type !== 'credit' && a.balance > 0)
      .reduce((sum, a) => sum + toBase(a.balance, a.currency), 0);
    const openDebts = debts.filter((d) => d.status !== 'paid');
    const receivables = openDebts
      .filter((d) => d.direction === 'owed_to_me')
      .reduce((sum, d) => sum + toBase(d.remaining_amount, d.currency), 0);
    const creditOwed = accounts
      .filter((a) => a.type === 'credit' && a.balance < 0)
      .reduce((sum, a) => sum + toBase(-a.balance, a.currency), 0);
    const owed =
      openDebts.filter((d) => d.direction === 'i_owe').reduce((sum, d) => sum + toBase(d.remaining_amount, d.currency), 0) +
      creditOwed;
    return { cash, receivables, owed };
  }, [accounts, debts, fxRates, currency]);

  const other = toMinorUnits(Number(otherAssets) || 0);
  const total = cash + other + (includeReceivables ? receivables : 0);
  const net = Math.max(0, total - (deductDebts ? owed : 0));
  const nisab = toMinorUnits(Number(nisabInput) || 0);
  const due = nisab > 0 && net >= nisab;
  const zakat = due ? Math.round(net * ZAKAT_RATE) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Zakat" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md, alignItems: 'center' }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Zakat due</Text>
          <Text style={[typography.largeTitle, { color: due ? colors.green : colors.label, marginTop: 4 }]}>
            {formatMoney(zakat, currency)}
          </Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4, textAlign: 'center' }]}>
            {nisab === 0
              ? 'Enter the current nisab value below to calculate.'
              : due
                ? '2.5% of your zakatable wealth'
                : `Below nisab (${formatMoney(nisab, currency)}) — no zakat due`}
          </Text>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <TextField
            label={`Gold price per gram, 24k (${currency})`}
            placeholder="Optional — fills in the nisab below"
            keyboardType="decimal-pad"
            value={goldInput}
            onChangeText={(v) => {
              setGoldInput(v);
              const price = Number(v);
              if (price > 0) setNisabInput((price * NISAB_GOLD_GRAMS).toFixed(2));
            }}
            onBlur={() => {
              setGoldPricePerGram(Number(goldInput) || 0);
              setZakatNisab(Number(nisabInput) || 0);
            }}
          />
          <TextField
            label={`Nisab value (${currency}) — ${NISAB_GOLD_GRAMS}g of gold`}
            placeholder="Value of 85g gold today"
            keyboardType="decimal-pad"
            value={nisabInput}
            onChangeText={setNisabInput}
            onBlur={() => setZakatNisab(Number(nisabInput) || 0)}
          />
          <TextField
            label={`Gold, silver, investments (${currency})`}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={otherAssets}
            onChangeText={setOtherAssets}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.body, { color: colors.label, flex: 1 }]}>Include money owed to you</Text>
            <Switch value={includeReceivables} onValueChange={setIncludeReceivables} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.body, { color: colors.label, flex: 1 }]}>Deduct debts you owe</Text>
            <Switch value={deductDebts} onValueChange={setDeductDebts} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Row label="Cash & bank" value={formatMoney(cash, currency)} />
          <Row label="Other assets" value={formatMoney(other, currency)} />
          {includeReceivables ? <Row label="Owed to you" value={formatMoney(receivables, currency)} /> : null}
          {deductDebts ? <Row label="Debts you owe" value={`−${formatMoney(owed, currency)}`} color={colors.red} /> : null}
          <View style={{ height: 0.5, backgroundColor: colors.separator, marginVertical: spacing.xs }} />
          <Row label="Zakatable wealth" value={formatMoney(net, currency)} />
        </Card>

        <SadaqahCard />

        <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
          Zakat is due on wealth at or above nisab held for one lunar year (hawl). This is an estimate from your balances in
          Anchor — confirm the details of your situation with a scholar.
        </Text>
      </ScrollView>
    </View>
  );
}
