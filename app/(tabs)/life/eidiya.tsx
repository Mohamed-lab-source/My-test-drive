import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { usePersonalStore, ensurePersonalLoaded } from '../../../src/store/personalStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { formatMoneyWhole, toMinorUnits } from '../../../src/utils/money';
import { EGP_NOTES, eidiyaNotes, eidiyaTotals, notesFor } from '../../../src/utils/eidiya';
import * as Haptics from '../../../src/utils/haptics';

const GROUPS = ['Kids', 'Nieces & nephews', 'Family', 'Helpers', 'Friends'];
const AMOUNTS = [20, 50, 100, 200, 500];

// Eidiya (العيدية): who gets how much, and the new notes to get from the
// bank so every envelope is exact.
export default function EidiyaScreen() {
  const { colors, typography, spacing } = useTheme();
  const people = usePersonalStore((s) => s.eidiya);
  const { add, update, remove } = usePersonalStore(useShallow((s) => ({ add: s.add, update: s.update, remove: s.remove })));
  const currency = useSettingsStore((s) => s.currency);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [group, setGroup] = useState<string>(GROUPS[0]);

  useEffect(() => ensurePersonalLoaded(), []);

  const totals = eidiyaTotals(people);
  const egp = currency === 'EGP';
  const notes = useMemo(() => eidiyaNotes(people, egp ? EGP_NOTES : [200, 100, 50, 20, 10, 5, 1]), [people, egp]);
  const groups = [...new Set(people.map((p) => p.group ?? 'Other'))];

  const addPerson = async () => {
    if (!name.trim() || !(Number(amount) > 0)) return;
    await add('eidiya', { name: name.trim(), amount: toMinorUnits(Number(amount)), currency, given: false, group });
    setName('');
  };

  const newEid = () =>
    Alert.alert('Start a new Eid?', 'Keeps everyone and their amounts, and clears the ticks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New Eid',
        onPress: async () => {
          for (const p of people) if (p.given) await update('eidiya', p.id, { ...p, given: false });
        },
      },
    ]);

  const shareNotes = () =>
    Share.share({
      message: `Eidiya notes to get from the bank:\n${notes.map((n) => `${n.count} × ${n.note}`).join('\n')}\nTotal: ${formatMoneyWhole(totals.left, currency)}`,
    }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Eidiya"
        right={
          people.length ? (
            <Pressable onPress={newEid} hitSlop={8} accessibilityRole="button">
              <Text style={[typography.body, { color: colors.blue }]}>New Eid</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Eid Mubarak 🌙 · {totals.people} envelope{totals.people === 1 ? '' : 's'}</Text>
          <Text style={[typography.title1, { color: colors.label }]}>{formatMoneyWhole(totals.total, currency)}</Text>
          {totals.total ? (
            <>
              <View style={{ marginTop: spacing.xs }}>
                <ProgressBar progress={totals.given / totals.total} color={colors.purple} />
              </View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                {totals.left ? `${formatMoneyWhole(totals.given, currency)} given · ${formatMoneyWhole(totals.left, currency)} to go` : 'Everyone has their Eidiya ✨'}
              </Text>
            </>
          ) : null}
        </Card>

        {notes.length ? (
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>New notes to get</Text>
              <Pressable onPress={shareNotes} hitSlop={8}>
                <Text style={[typography.subhead, { color: colors.blue }]}>Share</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
              {notes.map((n) => (
                <View key={n.note} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.tertiaryFill, marginRight: 6, marginBottom: 6 }}>
                  <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
                    {n.count} × {n.note}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>Enough for every envelope still to give, with no change needed.</Text>
          </Card>
        ) : null}

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Add someone</Text>
          <TextField placeholder="Name" value={name} onChangeText={setName} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -4, marginBottom: 6 }}>
            {AMOUNTS.map((a) => (
              <Pressable key={a} onPress={() => setAmount(String(a))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: Number(amount) === a ? colors.purple : colors.tertiaryFill, marginRight: 6, marginBottom: 6 }}>
                <Text style={[typography.subhead, { color: Number(amount) === a ? '#FFFFFF' : colors.label }]}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <TextField placeholder={`Amount (${currency})`} keyboardType="number-pad" value={amount} onChangeText={setAmount} />
          <ChipSelector options={GROUPS.map((g) => ({ id: g, label: g }))} selectedId={group} onSelect={setGroup} />
          <Button title="Add" onPress={addPerson} disabled={!name.trim() || !(Number(amount) > 0)} style={{ marginTop: spacing.sm }} />
        </Card>

        {groups.map((g) => {
          const list = people.filter((p) => (p.group ?? 'Other') === g);
          return (
            <View key={g} style={{ marginBottom: spacing.md }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>
                {g} · {formatMoneyWhole(list.reduce((s, p) => s + p.amount, 0), currency)}
              </Text>
              {list.map((p) => (
                <SwipeableRow key={p.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => remove('eidiya', p.id) }]}>
                  <Pressable
                    onPress={async () => {
                      await update('eidiya', p.id, { ...p, given: !p.given });
                      if (!p.given) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: p.given }}
                  >
                    <Card style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                      <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{p.given ? '✅' : '✉️'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { color: p.given ? colors.secondaryLabel : colors.label, textDecorationLine: p.given ? 'line-through' : 'none' }]}>{p.name}</Text>
                        <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
                          {Object.entries(notesFor(p.amount / 100))
                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                            .map(([n, k]) => `${k}×${n}`)
                            .join(' + ')}
                        </Text>
                      </View>
                      <Text style={[typography.headline, { color: colors.label }]}>{formatMoneyWhole(p.amount, p.currency)}</Text>
                    </Card>
                  </Pressable>
                </SwipeableRow>
              ))}
            </View>
          );
        })}
        {people.length ? <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center' }]}>Tap someone when you've given their Eidiya. Swipe to remove.</Text> : null}
      </ScrollView>
    </View>
  );
}
