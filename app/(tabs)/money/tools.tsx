import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { monthlyInstallment } from '../../../src/utils/installment';
import { formatMoney, toMinorUnits } from '../../../src/utils/money';

export default function ToolsScreen() {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const fxRates = useFinanceStore((s) => s.fxRates);

  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState('12');
  const p = Number(principal) || 0;
  const n = Math.round(Number(months) || 0);
  const monthly = monthlyInstallment(p, Number(rate) || 0, n);
  const total = monthly * n;

  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<string>(fxRates[0]?.currency ?? currency);
  const [direction, setDirection] = useState<'toBase' | 'fromBase'>('toBase');
  const rateFor = fxRates.find((r) => r.currency === from)?.rate_to_base ?? null;
  const a = Number(amount) || 0;
  const converted = rateFor ? (direction === 'toBase' ? a * rateFor : a / rateFor) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Money tools" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Instalment calculator</Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <TextField label={`Amount (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={principal} onChangeText={setPrincipal} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <TextField label="Annual rate %" placeholder="0 for interest-free" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Months" keyboardType="number-pad" value={months} onChangeText={setMonths} />
            </View>
          </View>
          <ChipSelector
            options={[6, 12, 24, 36, 60].map((m) => ({ id: String(m), label: `${m} mo` }))}
            selectedId={String(n)}
            onSelect={setMonths}
          />
          {monthly > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Monthly payment</Text>
              <Text style={[typography.title1, { color: colors.label }]}>{formatMoney(toMinorUnits(monthly), currency)}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                Total {formatMoney(toMinorUnits(total), currency)}
                {total - p > 0.005 ? ` · extra cost ${formatMoney(toMinorUnits(total - p), currency)}` : ' · no extra cost'}
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Currency converter</Text>
        <Card>
          {fxRates.length === 0 ? (
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>
              Add exchange rates in Settings (they appear once you have an account in another currency) to convert here.
            </Text>
          ) : (
            <>
              <ChipSelector options={fxRates.map((r) => ({ id: r.currency, label: r.currency }))} selectedId={from} onSelect={setFrom} />
              <View style={{ marginTop: spacing.sm }}>
                <ChipSelector
                  options={[
                    { id: 'toBase', label: `${from} → ${currency}` },
                    { id: 'fromBase', label: `${currency} → ${from}` },
                  ]}
                  selectedId={direction}
                  onSelect={(id) => setDirection(id as 'toBase' | 'fromBase')}
                />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <TextField
                  label={`Amount (${direction === 'toBase' ? from : currency})`}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              {converted !== null && a > 0 ? (
                <>
                  <Text style={[typography.title1, { color: colors.label }]}>
                    {formatMoney(toMinorUnits(converted), direction === 'toBase' ? currency : from)}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                    Using your saved rate 1 {from} = {rateFor} {currency}
                  </Text>
                </>
              ) : null}
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
