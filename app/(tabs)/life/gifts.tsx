import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { usePersonalStore, ensurePersonalLoaded, type Item } from '../../../src/store/personalStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { smsTargetAccount } from '../../../src/sms/smsStore';
import { listOccasions } from '../../../src/db/repositories/occasions';
import { todayKey } from '../../../src/db/client';
import { daysUntilAnnual, formatDateKey } from '../../../src/utils/date';
import { formatMoneyWhole, toMinorUnits } from '../../../src/utils/money';
import { GIFT_OCCASIONS, giftBalances, giftSuggestion, giftsToReturn, giftYearTotals, personKey, type Gift, type GiftOccasion } from '../../../src/utils/gifts';
import type { Occasion } from '../../../src/db/types';

const occ = (id: GiftOccasion) => GIFT_OCCASIONS.find((o) => o.id === id) ?? GIFT_OCCASIONS[GIFT_OCCASIONS.length - 1];

// Gifts and nokta (النقطة): what you gave and got at weddings, births and
// Eids, so you always know what to give back.
export default function GiftsScreen() {
  const { colors, typography, spacing } = useTheme();
  const gifts = usePersonalStore((s) => s.gift);
  const { add, update, remove } = usePersonalStore(useShallow((s) => ({ add: s.add, update: s.update, remove: s.remove })));
  const currency = useSettingsStore((s) => s.currency);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Item<Gift> | Partial<Gift> | null>(null);
  const [occasions, setOccasions] = useState<Occasion[]>([]);

  useEffect(() => {
    ensurePersonalLoaded();
    listOccasions().then(setOccasions).catch(() => {});
  }, []);

  const year = new Date().getFullYear();
  const totals = giftYearTotals(gifts, year);
  const balances = useMemo(() => giftBalances(gifts), [gifts]);
  const toReturn = useMemo(() => giftsToReturn(gifts), [gifts]);
  const q = personKey(query);
  const shownPeople = balances.filter((b) => !q || b.key.includes(q));
  const history = [...gifts].sort((a, b) => b.date.localeCompare(a.date)).filter((g) => !q || personKey(g.person).includes(q));
  const soon = occasions
    .map((o) => ({ o, days: daysUntilAnnual(o.month, o.day) }))
    .filter((x) => x.days <= 30)
    .sort((a, b) => a.days - b.days);

  const giftLine = (g: Gift) =>
    [g.amount != null ? formatMoneyWhole(g.amount, g.currency) : null, g.item].filter(Boolean).join(' + ') || '—';

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Gifts & nokta" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md, flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Given in {year}</Text>
            <Text style={[typography.title3, { color: colors.label }]}>{formatMoneyWhole(totals.given, currency)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Received in {year}</Text>
            <Text style={[typography.title3, { color: colors.label }]}>{formatMoneyWhole(totals.received, currency)}</Text>
          </View>
        </Card>

        {soon.length ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: 4 }]}>Coming up</Text>
            {soon.slice(0, 4).map(({ o, days }) => {
              const sug = giftSuggestion(o.name, gifts) ?? (() => {
                const b = toReturn.find((x) => personKey(o.name).includes(x.key));
                return b?.lastReceived?.amount != null ? { amount: b.lastReceived.amount, currency: b.lastReceived.currency } : null;
              })();
              return (
                <Pressable key={o.id} onPress={() => setEditing({ person: o.name, direction: 'given', occasion: o.kind === 'birthday' ? 'birthday' : o.kind === 'anniversary' ? 'wedding' : 'other', amount: sug?.amount ?? null })} style={{ paddingVertical: 6 }}>
                  <Text style={[typography.subhead, { color: colors.label }]}>
                    {o.name} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                  </Text>
                  <Text style={[typography.caption1, { color: sug ? colors.purple : colors.secondaryLabel }]}>
                    {sug ? `They gave you ${formatMoneyWhole(sug.amount, sug.currency)} — tap to log your gift` : 'Tap to log a gift'}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        {toReturn.length ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label }]}>To give back</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: 4 }]}>They gave you a money gift and you haven't given since.</Text>
            {toReturn.slice(0, 6).map((b) => (
              <Pressable key={b.key} onPress={() => setEditing({ person: b.person, direction: 'given', amount: b.lastReceived!.amount, occasion: 'other' })} style={{ flexDirection: 'row', paddingVertical: 5 }}>
                <Text style={[typography.subhead, { color: colors.label, flex: 1 }]}>
                  {occ(b.lastReceived!.occasion).emoji} {b.person}
                </Text>
                <Text style={[typography.subhead, { color: colors.purple, fontWeight: '600' }]}>{formatMoneyWhole(b.lastReceived!.amount!, b.lastReceived!.currency)}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <TextField placeholder="Search a person" value={query} onChangeText={setQuery} />
        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['People', 'History']} selectedIndex={tab} onChange={setTab} />
        </View>

        {gifts.length === 0 ? (
          <EmptyState icon="gift.fill" title="No gifts yet" message="Log the nokta you give at weddings and what people gave you, and Anchor will tell you what to give back." />
        ) : tab === 0 ? (
          shownPeople.map((b) => (
            <Pressable key={b.key} onPress={() => setEditing({ person: b.person, direction: 'given', amount: giftSuggestion(b.person, gifts)?.amount ?? null, occasion: 'other' })}>
              <Card style={{ marginBottom: spacing.sm }}>
                <Text style={[typography.headline, { color: colors.label }]}>{b.person}</Text>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  You gave {formatMoneyWhole(b.given, currency)} · they gave {formatMoneyWhole(b.received, currency)} · {b.count} gift{b.count === 1 ? '' : 's'}
                </Text>
                {b.lastReceived ? (
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                    Last from them: {giftLine(b.lastReceived)} at {occ(b.lastReceived.occasion).label.toLowerCase()} · {formatDateKey(b.lastReceived.date)}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))
        ) : (
          history.map((g) => (
            <SwipeableRow key={g.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => remove('gift', g.id) }]}>
              <Pressable onPress={() => setEditing(g)}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{occ(g.occasion).emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.headline, { color: colors.label }]}>
                      {g.direction === 'given' ? `To ${g.person}` : `From ${g.person}`}
                    </Text>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                      {occ(g.occasion).label} · {formatDateKey(g.date)}
                      {g.note ? ` · ${g.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[typography.headline, { color: g.direction === 'given' ? colors.label : colors.green }]}>{giftLine(g)}</Text>
                </Card>
              </Pressable>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setEditing({ direction: 'given' })} />
      <GiftSheet
        editing={editing}
        currency={currency}
        people={balances.map((b) => b.person)}
        onClose={() => setEditing(null)}
        onSave={async (data, logExpense) => {
          const existing = editing && 'id' in editing ? (editing as Item<Gift>) : null;
          if (existing) await update('gift', existing.id, { ...existing, ...data });
          else await add('gift', data);
          if (logExpense && data.amount) {
            const { accounts, categories, addTransaction } = useFinanceStore.getState();
            const cat = categories.find((c) => c.kind !== 'income' && /gift|هدي/i.test(c.name)) ?? categories.find((c) => c.kind !== 'income' && /^other$/i.test(c.name));
            await addTransaction({
              type: 'expense',
              amount: data.amount,
              currency: data.currency,
              account_id: smsTargetAccount(accounts)?.id ?? null,
              transfer_to_account_id: null,
              category_id: cat?.id ?? null,
              recurring_id: null,
              note: `Gift for ${data.person} (${occ(data.occasion).label.toLowerCase()})`,
              date: new Date(`${data.date}T12:00:00`).toISOString(),
            });
          }
          setEditing(null);
        }}
        onDelete={
          editing && 'id' in editing
            ? () =>
                Alert.alert('Delete this gift?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await remove('gift', (editing as Item<Gift>).id);
                      setEditing(null);
                    },
                  },
                ])
            : undefined
        }
      />
    </View>
  );
}

function GiftSheet({
  editing,
  currency,
  people,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Partial<Gift> | null;
  currency: string;
  people: string[];
  onClose: () => void;
  onSave: (g: Gift, logExpense: boolean) => void;
  onDelete?: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const gifts = usePersonalStore((s) => s.gift);
  const [direction, setDirection] = useState<'given' | 'received'>('given');
  const [person, setPerson] = useState('');
  const [occasion, setOccasion] = useState<GiftOccasion>('wedding');
  const [amount, setAmount] = useState('');
  const [item, setItem] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const isNew = !(editing && 'id' in editing);

  useEffect(() => {
    if (!editing) return;
    setDirection(editing.direction ?? 'given');
    setPerson(editing.person ?? '');
    setOccasion(editing.occasion ?? 'wedding');
    setAmount(editing.amount != null ? String(editing.amount / 100) : '');
    setItem(editing.item ?? '');
    setDate(editing.date ?? todayKey());
    setNote(editing.note ?? '');
  }, [editing]);

  const suggestion = direction === 'given' && person.trim() ? giftSuggestion(person, gifts) : null;
  const matches = person.trim() ? people.filter((p) => personKey(p).includes(personKey(person)) && personKey(p) !== personKey(person)).slice(0, 4) : [];
  const valid = person.trim() && (Number(amount) > 0 || item.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const build = (): Gift => ({
    person: person.trim(),
    occasion,
    direction,
    amount: Number(amount) > 0 ? toMinorUnits(Number(amount)) : null,
    currency: editing?.currency ?? currency,
    item: item.trim() || null,
    date,
    note: note.trim() || null,
  });

  return (
    <Sheet visible={!!editing} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{isNew ? 'Log a gift' : 'Edit gift'}</Text>
        <SegmentedControl options={['I gave', 'I received']} selectedIndex={direction === 'given' ? 0 : 1} onChange={(i) => setDirection(i === 0 ? 'given' : 'received')} />
        <View style={{ height: spacing.sm }} />
        <TextField label={direction === 'given' ? 'To' : 'From'} placeholder="Name" value={person} onChangeText={setPerson} />
        {matches.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -6, marginBottom: spacing.sm }}>
            {matches.map((m) => (
              <Pressable key={m} onPress={() => setPerson(m)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.tertiaryFill, marginRight: 6, marginBottom: 4 }}>
                <Text style={[typography.footnote, { color: colors.blue }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: 4 }]}>Occasion</Text>
        <ChipSelector options={GIFT_OCCASIONS.map((o) => ({ id: o.id, label: `${o.emoji} ${o.label}` }))} selectedId={occasion} onSelect={(id) => setOccasion(id as GiftOccasion)} />
        <View style={{ height: spacing.sm }} />
        <TextField label={`Money (${editing?.currency ?? currency})`} keyboardType="decimal-pad" placeholder="Optional" value={amount} onChangeText={setAmount} />
        {suggestion && !amount ? (
          <Pressable onPress={() => setAmount(String(suggestion.amount / 100))} style={{ marginTop: -6, marginBottom: spacing.sm }}>
            <Text style={[typography.footnote, { color: colors.purple }]}>
              They gave you {formatMoneyWhole(suggestion.amount, suggestion.currency)} at their last occasion with you — tap to use it
            </Text>
          </Pressable>
        ) : null}
        <TextField label="Present" placeholder="Optional, e.g. a gold set" value={item} onChangeText={setItem} />
        <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        <TextField label="Note" placeholder="Optional" value={note} onChangeText={setNote} />
        <Button title="Save" disabled={!valid} onPress={() => onSave(build(), false)} />
        {isNew && direction === 'given' && Number(amount) > 0 ? (
          <Button title="Save & add as an expense" variant="secondary" disabled={!valid} onPress={() => onSave(build(), true)} style={{ marginTop: spacing.sm }} />
        ) : null}
        {onDelete ? <Button title="Delete" variant="secondary" onPress={onDelete} style={{ marginTop: spacing.sm }} /> : null}
      </ScrollView>
    </Sheet>
  );
}
