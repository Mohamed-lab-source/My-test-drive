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
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { ActionMenu } from '../../../src/ui/ActionMenu';
import { usePersonalStore, ensurePersonalLoaded, type Item } from '../../../src/store/personalStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { smsTargetAccount } from '../../../src/sms/smsStore';
import { formatMoneyWhole, toMinorUnits } from '../../../src/utils/money';
import { addMonthsKey, gameyaPot, gameyaSchedule, gameyaStatus, daysUntilDue, monthKey, type Gameya } from '../../../src/utils/gameya';

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

// Gam'eya (جمعية): your savings circles — whose turn it is, what you've
// paid, and when the pot comes to you.
export default function GameyaScreen() {
  const { colors, typography, spacing } = useTheme();
  const gameyas = usePersonalStore((s) => s.gameya);
  const { add, update, remove } = usePersonalStore(useShallow((s) => ({ add: s.add, update: s.update, remove: s.remove })));
  const currency = useSettingsStore((s) => s.currency);
  const { accounts, categories, addTransaction } = useFinanceStore(useShallow((s) => ({ accounts: s.accounts, categories: s.categories, addTransaction: s.addTransaction })));
  const [editing, setEditing] = useState<Item<Gameya> | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<Item<Gameya> | null>(null);

  useEffect(() => ensurePersonalLoaded(), []);

  const now = new Date();
  const running = gameyas.filter((g) => !gameyaStatus(g, now).finished);
  const monthly = running.reduce((s, g) => s + g.share, 0);

  const log = async (g: Item<Gameya>, type: 'expense' | 'income', amount: number, note: string) => {
    const account = smsTargetAccount(accounts);
    const cat = categories.find((c) => (type === 'expense' ? c.kind !== 'income' : c.kind !== 'expense') && /gam|جمع|saving|other/i.test(c.name));
    await addTransaction({ type, amount, currency: g.currency, account_id: account?.id ?? null, transfer_to_account_id: null, category_id: cat?.id ?? null, recurring_id: null, note, date: new Date().toISOString() });
  };

  const togglePaid = (g: Item<Gameya>, month: string) => {
    const paid = g.paid.includes(month);
    if (paid) {
      update('gameya', g.id, { ...g, paid: g.paid.filter((m) => m !== month) });
      return;
    }
    Alert.alert(`Pay ${monthLabel(month)}`, `${formatMoneyWhole(g.share, g.currency)} for ${g.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: () => update('gameya', g.id, { ...g, paid: [...g.paid, month] }) },
      {
        text: 'Paid & add expense',
        onPress: async () => {
          await update('gameya', g.id, { ...g, paid: [...g.paid, month] });
          await log(g, 'expense', g.share, `${g.name} gam'eya — ${monthLabel(month)}`);
        },
      },
    ]);
  };

  const received = (g: Item<Gameya>, month: string) =>
    Alert.alert('You received the pot?', `${formatMoneyWhole(gameyaPot(g), g.currency)} from ${g.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => update('gameya', g.id, { ...g, received: [...g.received, month] }) },
      {
        text: 'Yes & add income',
        onPress: async () => {
          await update('gameya', g.id, { ...g, received: [...g.received, month] });
          await log(g, 'income', gameyaPot(g), `${g.name} gam'eya payout`);
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Gam'eya" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {gameyas.length === 0 ? (
          <EmptyState icon="person.2.fill" title="No gam'eya yet" message="Add your جمعية to see whose turn it is, track your monthly share and know exactly when the pot is yours." />
        ) : (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Every month</Text>
            <Text style={[typography.title1, { color: colors.label }]}>{formatMoneyWhole(monthly, running[0]?.currency ?? currency)}</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              Across {running.length} running gam'eya{running.length === 1 ? '' : 's'}
            </Text>
          </Card>
        )}

        {gameyas.map((g) => {
          const st = gameyaStatus(g, now);
          const turns = gameyaSchedule(g);
          const due = daysUntilDue(g, now);
          const expanded = open === g.id;
          return (
            <Card key={g.id} style={{ marginBottom: spacing.md }}>
              <Pressable onPress={() => setOpen(expanded ? null : g.id)} onLongPress={() => setMenuFor(g)} accessibilityRole="button">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>{g.name}</Text>
                  <Pressable onPress={() => setMenuFor(g)} hitSlop={10} accessibilityLabel="More">
                    <Text style={[typography.headline, { color: colors.tertiaryLabel }]}>•••</Text>
                  </Pressable>
                </View>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  {formatMoneyWhole(g.share, g.currency)} a month · {g.members} members · pot {formatMoneyWhole(gameyaPot(g), g.currency)}
                </Text>
                <Text style={[typography.subhead, { color: colors.label, marginTop: spacing.xs }]}>
                  {st.finished
                    ? '✅ Finished'
                    : st.notStarted
                      ? `Starts ${monthLabel(g.startMonth)}`
                      : `Turn ${st.current!.turn} of ${g.members}${st.current!.name ? ` · ${st.current!.name} takes it` : ''}${st.current!.mine ? ' · your turn 🎉' : ''}`}
                </Text>
                {st.nextMine ? (
                  <Text style={[typography.subhead, { color: colors.green, fontWeight: '600', marginTop: 2 }]}>
                    {st.nextMine.monthsAway === 0 ? 'The pot is yours this month' : `Your turn: ${monthLabel(st.nextMine.month)} (in ${st.nextMine.monthsAway} month${st.nextMine.monthsAway === 1 ? '' : 's'})`}
                  </Text>
                ) : null}
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={st.totalToPay ? st.paidSoFar / st.totalToPay : 0} color={colors.teal} />
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                    Paid {formatMoneyWhole(st.paidSoFar, g.currency)} of {formatMoneyWhole(st.totalToPay, g.currency)} · you take {formatMoneyWhole(st.toReceive, g.currency)}
                  </Text>
                  {st.unpaidPast.length ? (
                    <Text style={[typography.caption1, { color: colors.red, marginTop: 2 }]}>Not marked paid: {st.unpaidPast.map(monthLabel).join(', ')}</Text>
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
                {st.current && !st.current.paid ? (
                  <Pressable onPress={() => togglePaid(g, st.current!.month)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: due < 0 ? colors.red : colors.teal, marginRight: 8, marginBottom: 6 }}>
                    <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>
                      Pay {monthLabel(st.current.month)}{due >= 0 ? ` (due ${due === 0 ? 'today' : `in ${due}d`})` : ' (late)'}
                    </Text>
                  </Pressable>
                ) : st.current ? (
                  <Text style={[typography.subhead, { color: colors.green, marginRight: 8, marginBottom: 6, paddingVertical: 7 }]}>✓ {monthLabel(st.current.month)} paid</Text>
                ) : null}
                {st.current?.mine && !st.current.received ? (
                  <Pressable onPress={() => received(g, st.current!.month)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.green, marginBottom: 6 }}>
                    <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>I got the pot</Text>
                  </Pressable>
                ) : null}
              </View>
              {expanded ? (
                <View style={{ marginTop: spacing.xs }}>
                  {turns.map((t) => (
                    <Pressable
                      key={t.turn}
                      onPress={() => togglePaid(g, t.month)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.separator }}
                    >
                      <Text style={[typography.subhead, { color: colors.secondaryLabel, width: 30 }]}>{t.turn}</Text>
                      <Text style={[typography.subhead, { color: t.month === monthKey(now) ? colors.blue : colors.label, flex: 1, fontWeight: t.mine ? '700' : '400' }]}>
                        {monthLabel(t.month)} · {t.mine ? 'You' : t.name ?? '—'}
                        {t.mine && t.received ? ' · received' : ''}
                      </Text>
                      <Text style={{ fontSize: 16 }}>{t.paid ? '✅' : '⬜️'}</Text>
                    </Pressable>
                  ))}
                  <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>Tap a month to mark your share paid.</Text>
                </View>
              ) : (
                <Text style={[typography.caption1, { color: colors.blue, marginTop: 2 }]}>Tap for the full schedule</Text>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <FAB onPress={() => setEditing('new')} />
      <GameyaSheet
        editing={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (editing && editing !== 'new') await update('gameya', editing.id, { ...editing, ...data });
          else await add('gameya', data);
          setEditing(null);
        }}
      />
      <ActionMenu
        visible={!!menuFor}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Edit', icon: 'pencil', onPress: () => setEditing(menuFor) },
                {
                  label: 'Delete',
                  icon: 'trash',
                  destructive: true,
                  section: true,
                  onPress: () =>
                    Alert.alert(`Delete ${menuFor.name}?`, 'Your payments already added as expenses stay.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => remove('gameya', menuFor.id) },
                    ]),
                },
              ]
            : []
        }
      />
    </View>
  );
}

function GameyaSheet({
  editing,
  currency,
  onClose,
  onSave,
}: {
  editing: Item<Gameya> | 'new' | null;
  currency: string;
  onClose: () => void;
  onSave: (g: Gameya) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const g = editing && editing !== 'new' ? editing : null;
  const thisMonth = monthKey(new Date());
  const [name, setName] = useState('');
  const [share, setShare] = useState('');
  const [members, setMembers] = useState('10');
  const [start, setStart] = useState(thisMonth);
  const [turns, setTurns] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [names, setNames] = useState('');

  useEffect(() => {
    if (!editing) return;
    setName(g?.name ?? '');
    setShare(g ? String(g.share / 100) : '');
    setMembers(String(g?.members ?? 10));
    setStart(g?.startMonth ?? thisMonth);
    setTurns(g ? g.myTurns.join(', ') : '');
    setPayDay(String(g?.payDay ?? 1));
    setNames(g ? g.names.join('\n') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const starts = useMemo(() => [-3, -2, -1, 0, 1, 2].map((k) => addMonthsKey(thisMonth, k)), [thisMonth]);
  const n = Math.max(2, Math.min(36, Number(members) || 0));
  const myTurns = turns
    .split(/[,\s]+/)
    .map(Number)
    .filter((x) => Number.isInteger(x) && x >= 1 && x <= n);
  const valid = name.trim() && Number(share) > 0 && myTurns.length > 0;

  return (
    <Sheet visible={!!editing} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{g ? 'Edit gam’eya' : 'New gam’eya'}</Text>
        <TextField label="Name" placeholder="e.g. Work gam'eya" value={name} onChangeText={setName} />
        <TextField label={`Monthly share (${g?.currency ?? currency})`} keyboardType="decimal-pad" value={share} onChangeText={setShare} />
        <TextField label="Members (turns)" keyboardType="number-pad" value={members} onChangeText={setMembers} />
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: 4 }]}>First turn</Text>
        <ChipSelector options={(starts.includes(start) ? starts : [start, ...starts]).map((k) => ({ id: k, label: monthLabelShort(k) }))} selectedId={start} onSelect={setStart} />
        <View style={{ height: spacing.sm }} />
        <TextField label="Your turn number(s)" placeholder="e.g. 4 (or 4, 9 for two turns)" keyboardType="numbers-and-punctuation" value={turns} onChangeText={setTurns} />
        <TextField label="Share due on day" keyboardType="number-pad" value={payDay} onChangeText={setPayDay} />
        <TextField label="Who takes each turn (optional, one per line)" placeholder={'Mona\nAli\n…'} multiline value={names} onChangeText={setNames} style={{ minHeight: 90 }} />
        {Number(share) > 0 ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            Pot: {formatMoneyWhole(toMinorUnits(Number(share)) * n, g?.currency ?? currency)} · ends {monthLabelShort(addMonthsKey(start, n - 1))}
          </Text>
        ) : null}
        <Button
          title="Save"
          disabled={!valid}
          onPress={() =>
            onSave({
              name: name.trim(),
              share: toMinorUnits(Number(share)),
              currency: g?.currency ?? currency,
              members: n,
              startMonth: start,
              myTurns: [...new Set(myTurns)].sort((a, b) => a - b),
              names: names.split('\n').map((x) => x.trim()),
              paid: g?.paid ?? [],
              received: g?.received ?? [],
              payDay: Math.min(28, Math.max(1, Number(payDay) || 1)),
            })
          }
        />
      </ScrollView>
    </Sheet>
  );
}

function monthLabelShort(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}
