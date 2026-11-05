import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { formatMoney, toMinorUnits } from '../../utils/money';
import { certificate, fuelCost, goldValue, instalmentRate, raise, ramadanBudget, restaurantBill } from '../../utils/egyptCalc';

// Calculators for everyday money in Egypt: restaurant bills with service
// and VAT, gold by karat, bank certificates, the interest hidden in an
// instalment plan, fuel, a raise and the Ramadan budget.
const num = (s: string) => Number(s.replace(/,/g, '')) || 0;

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <>
      <Text style={[typography.title3, { color: colors.label }]}>{title}</Text>
      {subtitle ? <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>{subtitle}</Text> : <View style={{ height: spacing.sm }} />}
      <Card style={{ marginBottom: spacing.lg }}>{children}</Card>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  const kids = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row' }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flex: 1, marginRight: i < kids.length - 1 ? spacing.sm : 0 }}>
          {k}
        </View>
      ))}
    </View>
  );
}

function Result({ label, value, note }: { label: string; value: string; note?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{label}</Text>
      <Text style={[typography.title2, { color: colors.label }]}>{value}</Text>
      {note ? <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{note}</Text> : null}
    </View>
  );
}

export function RestaurantBillCalculator({ currency }: { currency: string }) {
  const [sub, setSub] = useState('');
  const [service, setService] = useState('12');
  const [vat, setVat] = useState('14');
  const [people, setPeople] = useState('1');
  const r = restaurantBill(num(sub), num(service), num(vat), Math.round(num(people)) || 1);
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="Restaurant bill" subtitle="Menu prices plus 12% service and 14% VAT, split between you.">
      <TextField label={`Food total on the menu (${currency})`} keyboardType="decimal-pad" value={sub} onChangeText={setSub} />
      <Row>
        <TextField label="Service %" keyboardType="decimal-pad" value={service} onChangeText={setService} />
        <TextField label="VAT %" keyboardType="decimal-pad" value={vat} onChangeText={setVat} />
        <TextField label="People" keyboardType="number-pad" value={people} onChangeText={setPeople} />
      </Row>
      {num(sub) > 0 ? <Result label={Math.round(num(people)) > 1 ? 'Each person pays' : 'You pay'} value={m(r.each)} note={`Total ${m(r.total)} · service ${m(r.service)} · VAT ${m(r.vat)}`} /> : null}
    </Section>
  );
}

export function GoldCalculator({ currency }: { currency: string }) {
  const [grams, setGrams] = useState('');
  const [price, setPrice] = useState('');
  const [karat, setKarat] = useState('21');
  const k = Number(karat) as 24 | 21 | 18;
  const r = goldValue(num(grams), num(price), k);
  return (
    <Section title="Gold" subtitle="From today's 21k price per gram, worth by karat.">
      <Row>
        <TextField label="Grams" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
        <TextField label={`21k price / g (${currency})`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      </Row>
      <ChipSelector options={['24', '21', '18'].map((x) => ({ id: x, label: `${x}k` }))} selectedId={karat} onSelect={setKarat} />
      {num(price) > 0 ? (
        <Result
          label={`${karat}k is ${formatMoney(toMinorUnits(r.perGram), currency)} a gram`}
          value={num(grams) > 0 ? formatMoney(toMinorUnits(r.value), currency) : '—'}
          note={`24k ${formatMoney(toMinorUnits(goldValue(1, num(price), 24).perGram), currency)} · 18k ${formatMoney(toMinorUnits(goldValue(1, num(price), 18).perGram), currency)} a gram`}
        />
      ) : null}
    </Section>
  );
}

export function CertificateCalculator({ currency }: { currency: string }) {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('3');
  const [payout, setPayout] = useState<'monthly' | 'quarterly' | 'yearly' | 'end'>('monthly');
  const r = certificate(num(amount), num(rate), num(years), payout);
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="Bank certificate (شهادة)" subtitle="What a savings certificate pays you.">
      <TextField label={`Amount (${currency})`} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Row>
        <TextField label="Yearly rate %" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
        <TextField label="Years" keyboardType="decimal-pad" value={years} onChangeText={setYears} />
      </Row>
      <ChipSelector
        options={[
          { id: 'monthly', label: 'Monthly' },
          { id: 'quarterly', label: 'Quarterly' },
          { id: 'yearly', label: 'Yearly' },
          { id: 'end', label: 'At the end' },
        ]}
        selectedId={payout}
        onSelect={(id) => setPayout(id as typeof payout)}
      />
      {num(amount) > 0 && num(rate) > 0 ? (
        <Result label={payout === 'end' ? 'Interest at the end' : `Paid to you ${payout === 'monthly' ? 'each month' : payout === 'quarterly' ? 'each quarter' : 'each year'}`} value={m(r.perPayout)} note={`${m(r.total)} interest over ${num(years)} years`} />
      ) : null}
    </Section>
  );
}

export function HiddenInterestCalculator({ currency }: { currency: string }) {
  const [cash, setCash] = useState('');
  const [down, setDown] = useState('');
  const [monthly, setMonthly] = useState('');
  const [months, setMonths] = useState('12');
  const r = instalmentRate(num(cash), num(down), num(monthly), Math.round(num(months)));
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="Instalments or cash?" subtitle="The interest hidden in a shop's instalment plan.">
      <Row>
        <TextField label={`Cash price (${currency})`} keyboardType="decimal-pad" value={cash} onChangeText={setCash} />
        <TextField label="Down payment" keyboardType="decimal-pad" value={down} onChangeText={setDown} />
      </Row>
      <Row>
        <TextField label="Each month" keyboardType="decimal-pad" value={monthly} onChangeText={setMonthly} />
        <TextField label="Months" keyboardType="number-pad" value={months} onChangeText={setMonths} />
      </Row>
      {num(cash) > 0 && num(monthly) > 0 ? (
        <Result
          label="You pay extra"
          value={m(Math.max(0, r.extra))}
          note={r.monthlyRate > 0 ? `About ${r.monthlyRate.toFixed(2)}% a month — ${r.yearlyRate.toFixed(1)}% a year. Total ${m(r.totalPaid)}.` : r.extra <= 0 ? 'No extra cost — same as cash.' : `Total ${m(r.totalPaid)}.`}
        />
      ) : null}
    </Section>
  );
}

export function FuelTripCalculator({ currency }: { currency: string }) {
  const [km, setKm] = useState('');
  const [use, setUse] = useState('8');
  const [price, setPrice] = useState('');
  const [people, setPeople] = useState('1');
  const r = fuelCost(num(km), num(use), num(price), Math.round(num(people)) || 1);
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="Fuel for a trip" subtitle="Sahel, Ain Sokhna or Alex — what the petrol costs.">
      <Row>
        <TextField label="Distance (km)" keyboardType="decimal-pad" value={km} onChangeText={setKm} />
        <TextField label="L / 100 km" keyboardType="decimal-pad" value={use} onChangeText={setUse} />
      </Row>
      <Row>
        <TextField label={`Price / litre (${currency})`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <TextField label="People" keyboardType="number-pad" value={people} onChangeText={setPeople} />
      </Row>
      {num(km) > 0 && num(price) > 0 ? (
        <Result label={Math.round(num(people)) > 1 ? 'Each person pays' : 'Fuel costs'} value={m(r.each)} note={`${r.litres.toFixed(1)} litres · ${m(r.cost)} in all · ${m(r.cost * 2)} there and back`} />
      ) : null}
    </Section>
  );
}

export function RaiseCalculator({ currency }: { currency: string }) {
  const [salary, setSalary] = useState('');
  const [pct, setPct] = useState('15');
  const r = raise(num(salary), num(pct));
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="A raise" subtitle="Your new salary and what it's worth a day.">
      <Row>
        <TextField label={`Monthly salary (${currency})`} keyboardType="decimal-pad" value={salary} onChangeText={setSalary} />
        <TextField label="Raise %" keyboardType="decimal-pad" value={pct} onChangeText={setPct} />
      </Row>
      {num(salary) > 0 ? <Result label="New salary" value={m(r.next)} note={`+${m(r.diff)} a month · ${m(r.diff * 12)} a year · ${m(r.perDay)} a day`} /> : null}
    </Section>
  );
}

export function RamadanBudgetCalculator({ currency }: { currency: string }) {
  const [iftar, setIftar] = useState('');
  const [suhoor, setSuhoor] = useState('');
  const [days, setDays] = useState('30');
  const [extras, setExtras] = useState('');
  const r = ramadanBudget(num(iftar), num(suhoor), Math.round(num(days)) || 30, num(extras));
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <Section title="Ramadan budget" subtitle="Iftar and suhoor, plus Eid clothes, zakat al-fitr, yamesh and gatherings.">
      <Row>
        <TextField label="Iftar / day" keyboardType="decimal-pad" value={iftar} onChangeText={setIftar} />
        <TextField label="Suhoor / day" keyboardType="decimal-pad" value={suhoor} onChangeText={setSuhoor} />
      </Row>
      <Row>
        <TextField label="Days" keyboardType="number-pad" value={days} onChangeText={setDays} />
        <TextField label={`Extras (${currency})`} keyboardType="decimal-pad" value={extras} onChangeText={setExtras} />
      </Row>
      {r.total > 0 ? <Result label="For the month" value={m(r.total)} note={`${m(r.food)} on food · ${m(r.perDay)} a day in all`} /> : null}
    </Section>
  );
}
