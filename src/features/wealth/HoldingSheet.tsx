import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { ChipSelector } from '../../ui/ChipSelector';
import { Switch } from '../../ui/Switch';
import { toMinorUnits } from '../../utils/money';
import { HOLDING_KINDS, kindInfo, type Holding, type HoldingKind } from '../../utils/wealth';

// Add or edit something you've invested in.
export function HoldingSheet({
  editing,
  currency,
  avoidInterest,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Partial<Holding> | null;
  currency: string;
  avoidInterest: boolean;
  onClose: () => void;
  onSave: (h: Holding) => void;
  onDelete?: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const [kind, setKind] = useState<HoldingKind>('gold');
  const [name, setName] = useState('');
  const [invested, setInvested] = useState('');
  const [value, setValue] = useState('');
  const [cur, setCur] = useState(currency);
  const [grams, setGrams] = useState('');
  const [karat, setKarat] = useState<'24' | '21' | '18'>('21');
  const [rate, setRate] = useState('');
  const [maturity, setMaturity] = useState('');
  const [liquid, setLiquid] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!editing) return;
    const k = editing.kind ?? 'gold';
    setKind(k);
    setName(editing.name ?? '');
    setInvested(editing.invested != null ? String(editing.invested / 100) : '');
    setValue(editing.value != null ? String(editing.value / 100) : '');
    setCur(editing.currency ?? (k === 'fx' ? 'USD' : currency));
    setGrams(editing.grams != null ? String(editing.grams) : '');
    setKarat(String(editing.karat ?? 21) as '24' | '21' | '18');
    setRate(editing.ratePct != null ? String(editing.ratePct) : '');
    setMaturity(editing.maturity ?? '');
    setLiquid(editing.liquid ?? (k === 'moneyMarket' || k === 'fx'));
    setNote(editing.note ?? '');
  }, [editing, currency]);

  const info = kindInfo(kind);
  const isGold = kind === 'gold';
  const fixed = kind === 'certificate' || kind === 'sukuk';
  const valid = (Number(invested) > 0 || (isGold && Number(grams) > 0)) && (!maturity || /^\d{4}-\d{2}-\d{2}$/.test(maturity));

  return (
    <Sheet visible={!!editing} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.sm }]}>{editing && 'name' in editing && editing.name ? 'Edit investment' : 'Add an investment'}</Text>
        <ChipSelector
          options={HOLDING_KINDS.map((h) => ({ id: h.id, label: `${h.emoji} ${h.label}` }))}
          selectedId={kind}
          onSelect={(id) => {
            setKind(id as HoldingKind);
            if (id === 'fx' && cur === currency) setCur('USD');
            if (id !== 'fx' && cur !== currency) setCur(currency);
            if (id === 'moneyMarket') setLiquid(true);
          }}
        />
        <Text style={[typography.footnote, { color: info.interest && avoidInterest ? colors.orange : colors.secondaryLabel, marginVertical: spacing.xs }]}>
          {info.interest && avoidInterest ? '⚠️ ' : ''}
          {info.note}
        </Text>
        <TextField label="Name" placeholder={isGold ? 'e.g. 21k bracelet, 10g bar' : fixed ? 'e.g. 3-year certificate' : 'Optional'} value={name} onChangeText={setName} />
        {isGold ? (
          <>
            <TextField label="Grams" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
            <ChipSelector options={['24', '21', '18'].map((k) => ({ id: k, label: `${k}k` }))} selectedId={karat} onSelect={(k) => setKarat(k as '24' | '21' | '18')} />
            <View style={{ height: spacing.sm }} />
          </>
        ) : null}
        <TextField label={`${isGold ? 'Paid' : 'Put in'} (${cur})`} keyboardType="decimal-pad" value={invested} onChangeText={setInvested} />
        {kind === 'fx' ? <ChipSelector options={['USD', 'EUR', 'GBP', 'SAR', 'AED'].map((c) => ({ id: c, label: c }))} selectedId={cur} onSelect={setCur} /> : null}
        {!isGold && !fixed && kind !== 'fx' ? (
          <TextField label={`Worth today (${cur})`} placeholder="Leave empty if the same" keyboardType="decimal-pad" value={value} onChangeText={setValue} />
        ) : null}
        {fixed ? (
          <>
            <TextField label={kind === 'sukuk' ? 'Expected profit % a year' : 'Rate % a year'} keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
            <TextField label="Matures on (YYYY-MM-DD)" placeholder="Optional" keyboardType="numbers-and-punctuation" value={maturity} onChangeText={setMaturity} />
          </>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.label }]}>Can be cashed within days</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Lets you count it toward backup money.</Text>
          </View>
          <Switch value={liquid} onValueChange={setLiquid} />
        </View>
        <TextField label="Note" placeholder="Optional — bank, broker, where it's kept" value={note} onChangeText={setNote} />
        <Button
          title="Save"
          disabled={!valid}
          onPress={() =>
            onSave({
              kind,
              name: name.trim() || (isGold ? `${grams}g ${karat}k gold` : info.label),
              invested: toMinorUnits(Number(invested) || 0),
              value: value.trim() && Number(value) >= 0 ? toMinorUnits(Number(value)) : null,
              currency: cur,
              grams: isGold && Number(grams) > 0 ? Number(grams) : null,
              karat: isGold ? (Number(karat) as 24 | 21 | 18) : null,
              ratePct: fixed && rate ? Number(rate) : null,
              maturity: fixed && maturity ? maturity : null,
              liquid,
              note: note.trim() || null,
            })
          }
        />
        {onDelete ? <Button title="Delete" variant="secondary" onPress={onDelete} style={{ marginTop: spacing.sm }} /> : null}
      </ScrollView>
    </Sheet>
  );
}
