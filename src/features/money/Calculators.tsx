import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { formatMoney, toMinorUnits } from '../../utils/money';

const num = (s: string) => Number(s.replace(/,/g, '')) || 0;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <>
      <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>{title}</Text>
      <Card style={{ marginBottom: spacing.lg }}>{children}</Card>
    </>
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

// Month-by-month split of an amortised loan into interest and principal.
export function AmortisationTable({ principal, annualRate, months, payment, currency }: { principal: number; annualRate: number; months: number; payment: number; currency: string }) {
  const { colors, typography, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  if (!(principal > 0 && months > 0 && payment > 0)) return null;
  const r = annualRate / 100 / 12;
  let balance = principal;
  const rows = Array.from({ length: months }, (_, i) => {
    const interest = balance * r;
    const toPrincipal = payment - interest;
    balance = Math.max(0, balance - toPrincipal);
    return { n: i + 1, interest, toPrincipal, balance };
  });
  const shown = open ? rows : rows.slice(0, 3);
  const m = (x: number) => formatMoney(toMinorUnits(x), currency);
  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
        {['#', 'Interest', 'Principal', 'Left'].map((h, i) => (
          <Text key={h} style={[typography.caption1, { color: colors.secondaryLabel, flex: i === 0 ? 0.4 : 1, textAlign: i === 0 ? 'left' : 'right' }]}>
            {h}
          </Text>
        ))}
      </View>
      {shown.map((row) => (
        <View key={row.n} style={{ flexDirection: 'row', paddingVertical: 2 }}>
          <Text style={[typography.caption1, { color: colors.label, flex: 0.4 }]}>{row.n}</Text>
          <Text style={[typography.caption1, { color: colors.red, flex: 1, textAlign: 'right' }]}>{m(row.interest)}</Text>
          <Text style={[typography.caption1, { color: colors.label, flex: 1, textAlign: 'right' }]}>{m(row.toPrincipal)}</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, flex: 1, textAlign: 'right' }]}>{m(row.balance)}</Text>
        </View>
      ))}
      {rows.length > 3 ? (
        <Pressable onPress={() => setOpen(!open)} style={{ marginTop: 4 }}>
          <Text style={[typography.subhead, { color: colors.blue }]}>{open ? 'Show less' : `Show all ${rows.length} months`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TipSplitCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [bill, setBill] = useState('');
  const [tip, setTip] = useState('10');
  const [people, setPeople] = useState('2');
  const total = num(bill) * (1 + num(tip) / 100);
  const each = total / Math.max(1, Math.round(num(people)));
  return (
    <Section title="Tip & split">
      <TextField label={`Bill (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={bill} onChangeText={setBill} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label="Tip %" keyboardType="decimal-pad" value={tip} onChangeText={setTip} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="People" keyboardType="number-pad" value={people} onChangeText={setPeople} />
        </View>
      </View>
      <ChipSelector options={['0', '10', '12', '15', '20'].map((t) => ({ id: t, label: `${t}%` }))} selectedId={tip} onSelect={setTip} />
      {num(bill) > 0 ? <Result label="Each person pays" value={formatMoney(toMinorUnits(each), currency)} note={`Total with tip ${formatMoney(toMinorUnits(total), currency)}`} /> : null}
    </Section>
  );
}

export function DiscountCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [price, setPrice] = useState('');
  const [off, setOff] = useState('20');
  const [extra, setExtra] = useState('');
  const after = num(price) * (1 - num(off) / 100) * (1 - num(extra) / 100);
  return (
    <Section title="Sale price">
      <TextField label={`Original price (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label="Discount %" keyboardType="decimal-pad" value={off} onChangeText={setOff} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Extra % off" placeholder="Optional" keyboardType="decimal-pad" value={extra} onChangeText={setExtra} />
        </View>
      </View>
      {num(price) > 0 ? (
        <Result
          label="You pay"
          value={formatMoney(toMinorUnits(after), currency)}
          note={`You save ${formatMoney(toMinorUnits(num(price) - after), currency)} (${Math.round((1 - after / num(price)) * 100)}% in total)`}
        />
      ) : null}
    </Section>
  );
}

// Compound growth with a monthly top-up.
export function GrowthCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [start, setStart] = useState('');
  const [monthly, setMonthly] = useState('');
  const [rate, setRate] = useState('20');
  const [years, setYears] = useState('5');
  const r = num(rate) / 100 / 12;
  const n = Math.round(num(years) * 12);
  const fv = r === 0 ? num(start) + num(monthly) * n : num(start) * Math.pow(1 + r, n) + num(monthly) * ((Math.pow(1 + r, n) - 1) / r);
  const paidIn = num(start) + num(monthly) * n;
  return (
    <Section title="Savings growth">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label="Start with" placeholder="0" keyboardType="decimal-pad" value={start} onChangeText={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Add monthly" placeholder="0" keyboardType="decimal-pad" value={monthly} onChangeText={setMonthly} />
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label="Yearly return %" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Years" keyboardType="decimal-pad" value={years} onChangeText={setYears} />
        </View>
      </View>
      {paidIn > 0 && n > 0 ? (
        <Result
          label={`After ${num(years)} years`}
          value={formatMoney(toMinorUnits(fv), currency)}
          note={`You put in ${formatMoney(toMinorUnits(paidIn), currency)} · growth ${formatMoney(toMinorUnits(fv - paidIn), currency)}`}
        />
      ) : null}
    </Section>
  );
}

export function TimeToSaveCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [goal, setGoal] = useState('');
  const [have, setHave] = useState('');
  const [perMonth, setPerMonth] = useState('');
  const left = Math.max(0, num(goal) - num(have));
  const months = num(perMonth) > 0 ? Math.ceil(left / num(perMonth)) : null;
  const when = months !== null ? new Date(new Date().getFullYear(), new Date().getMonth() + months, 1) : null;
  return (
    <Section title="How long to save">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label="Goal" placeholder="0" keyboardType="decimal-pad" value={goal} onChangeText={setGoal} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Saved so far" placeholder="0" keyboardType="decimal-pad" value={have} onChangeText={setHave} />
        </View>
      </View>
      <TextField label={`Can save per month (${currency})`} placeholder="0" keyboardType="decimal-pad" value={perMonth} onChangeText={setPerMonth} />
      {months !== null && num(goal) > 0 ? (
        <Result
          label="Time needed"
          value={months === 0 ? 'Already there 🎉' : `${months} month${months === 1 ? '' : 's'}`}
          note={when && months > 0 ? `Around ${when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : undefined}
        />
      ) : null}
    </Section>
  );
}

// Which pack is cheaper per unit (kg, litre, piece…).
export function UnitPriceCalculator({ currency }: { currency: string }) {
  const { spacing, colors, typography } = useTheme();
  const [a, setA] = useState({ price: '', size: '' });
  const [b, setB] = useState({ price: '', size: '' });
  const per = (x: { price: string; size: string }) => (num(x.size) > 0 ? num(x.price) / num(x.size) : null);
  const pa = per(a);
  const pb = per(b);
  const row = (label: string, v: { price: string; size: string }, set: (v: { price: string; size: string }) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={[typography.headline, { color: colors.label, width: 24, marginBottom: 22 }]}>{label}</Text>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <TextField label="Price" keyboardType="decimal-pad" value={v.price} onChangeText={(t) => set({ ...v, price: t })} />
      </View>
      <View style={{ flex: 1 }}>
        <TextField label="Size (g, ml, pcs)" keyboardType="decimal-pad" value={v.size} onChangeText={(t) => set({ ...v, size: t })} />
      </View>
    </View>
  );
  return (
    <Section title="Which is cheaper?">
      {row('A', a, setA)}
      {row('B', b, setB)}
      {pa !== null && pb !== null ? (
        <Result
          label="Better value"
          value={pa === pb ? 'Same price per unit' : `${pa < pb ? 'A' : 'B'} is ${Math.round((1 - Math.min(pa, pb) / Math.max(pa, pb)) * 100)}% cheaper`}
          note={`A: ${formatMoney(toMinorUnits(pa * 100), currency)} per 100 · B: ${formatMoney(toMinorUnits(pb * 100), currency)} per 100`}
        />
      ) : null}
    </Section>
  );
}

// Egypt's VAT is 14%; any rate works. Adds VAT to a price or takes it out.
export function VatCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('14');
  const a = num(amount);
  const r = num(rate) / 100;
  return (
    <Section title="VAT">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 2, marginRight: spacing.sm }}>
          <TextField label={`Amount (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="VAT %" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
        </View>
      </View>
      {a > 0 ? (
        <>
          <Result label="Price + VAT" value={formatMoney(toMinorUnits(a * (1 + r)), currency)} note={`VAT ${formatMoney(toMinorUnits(a * r), currency)}`} />
          <Result label="If VAT is already included" value={formatMoney(toMinorUnits(a / (1 + r)), currency)} note={`of which VAT ${formatMoney(toMinorUnits(a - a / (1 + r)), currency)}`} />
        </>
      ) : null}
    </Section>
  );
}

// What your salary is worth per day and per hour, and what a purchase costs in work.
export function SalaryCalculator({ currency }: { currency: string }) {
  const { spacing } = useTheme();
  const [salary, setSalary] = useState('');
  const [hours, setHours] = useState('40');
  const [price, setPrice] = useState('');
  const perHour = num(salary) / ((num(hours) || 40) * 4.33);
  return (
    <Section title="Salary & time">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 2, marginRight: spacing.sm }}>
          <TextField label={`Monthly salary (${currency})`} placeholder="0" keyboardType="decimal-pad" value={salary} onChangeText={setSalary} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Hours/week" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
        </View>
      </View>
      <TextField label="Something you want to buy (optional)" placeholder="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      {num(salary) > 0 ? (
        <Result
          label="You earn"
          value={`${formatMoney(toMinorUnits(perHour), currency)}/hour`}
          note={`${formatMoney(toMinorUnits(num(salary) / 30), currency)} a day${
            num(price) > 0 ? ` · that purchase costs ${(num(price) / perHour).toFixed(1)} hours of work` : ''
          }`}
        />
      ) : null}
    </Section>
  );
}

// Is it worth it? Price spread over how often you'll use it.
export function CostPerUseCalculator({ currency }: { currency: string }) {
  const [price, setPrice] = useState('');
  const [uses, setUses] = useState('');
  const [years, setYears] = useState('1');
  const p = num(price);
  const u = num(uses);
  const y = Math.max(1, num(years));
  return (
    <Section title="Cost per use">
      <TextField label="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <TextField label="Uses a week" keyboardType="decimal-pad" value={uses} onChangeText={setUses} />
      <TextField label="For how many years" keyboardType="decimal-pad" value={years} onChangeText={setYears} />
      {p > 0 && u > 0 ? (
        <Result
          label="Each use costs"
          value={formatMoney(toMinorUnits(p / (u * 52 * y)), currency)}
          note={`${Math.round(u * 52 * y)} uses over ${y} year${y === 1 ? '' : 's'}`}
        />
      ) : null}
    </Section>
  );
}

// How long a card balance takes to clear at a fixed monthly payment, and
// the interest paid on the way.
export function CardPayoffCalculator({ currency }: { currency: string }) {
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [payment, setPayment] = useState('');
  const b = num(balance);
  const r = num(apr) / 1200;
  const p = num(payment);
  let months: number | null = null;
  if (b > 0 && p > 0) {
    if (r === 0) months = Math.ceil(b / p);
    else if (p > b * r) months = Math.ceil(-Math.log(1 - (r * b) / p) / Math.log(1 + r));
  }
  return (
    <Section title="Card payoff">
      <TextField label="Balance owed" keyboardType="decimal-pad" value={balance} onChangeText={setBalance} />
      <TextField label="Interest rate % a year" keyboardType="decimal-pad" value={apr} onChangeText={setApr} />
      <TextField label="Monthly payment" keyboardType="decimal-pad" value={payment} onChangeText={setPayment} />
      {b > 0 && p > 0 ? (
        months === null ? (
          <Result label="Result" value="Never" note="This payment doesn't cover the monthly interest." />
        ) : (
          <Result
            label="Paid off in"
            value={`${months} month${months === 1 ? '' : 's'}`}
            note={`About ${formatMoney(toMinorUnits(Math.max(0, months * p - b)), currency)} in interest`}
          />
        )
      ) : null}
    </Section>
  );
}

// The 50/30/20 rule: needs, wants and savings from take-home pay.
export function FiftyThirtyTwentyCalculator({ currency, income }: { currency: string; income: number }) {
  const { colors, typography } = useTheme();
  const [input, setInput] = useState(income > 0 ? String(Math.round(income / 100)) : '');
  const total = num(input);
  return (
    <Section title="50 / 30 / 20 budget">
      <TextField label="Monthly take-home pay" keyboardType="decimal-pad" value={input} onChangeText={setInput} />
      {total > 0
        ? [
            { label: 'Needs (rent, bills, food)', share: 0.5, color: colors.indigo },
            { label: 'Wants (eating out, fun)', share: 0.3, color: colors.orange },
            { label: 'Savings & debt', share: 0.2, color: colors.green },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: row.color, marginRight: 8 }} />
              <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{row.label}</Text>
              <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>{formatMoney(toMinorUnits(total * row.share), currency)}</Text>
            </View>
          ))
        : null}
    </Section>
  );
}
