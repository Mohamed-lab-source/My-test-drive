import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import * as repo from '../../../src/db/repositories/lists';
import { todayKey } from '../../../src/db/client';
import { formatDateKey } from '../../../src/utils/date';
import { daysUntilKey, describeCountdown, parseDateKey } from '../../../src/utils/countdown';
import type { Countdown } from '../../../src/db/types';

const QUICK = [
  { id: '7', label: 'In a week' },
  { id: '30', label: 'In a month' },
  { id: '90', label: 'In 3 months' },
  { id: '365', label: 'In a year' },
];

export default function CountdownsScreen() {
  const { colors, typography, spacing } = useTheme();
  const [items, setItems] = useState<Countdown[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dateInput, setDateInput] = useState('');

  const load = useCallback(() => repo.listCountdowns().then(setItems), []);
  useEffect(() => {
    load();
  }, [load]);

  const parsed = parseDateKey(dateInput);
  const save = async () => {
    if (!parsed || !title.trim()) return;
    await repo.createCountdown(title.trim(), parsed);
    setTitle('');
    setDateInput('');
    setAdding(false);
    await load();
  };

  const upcoming = items.filter((c) => daysUntilKey(c.date) >= 0);
  const past = items.filter((c) => daysUntilKey(c.date) < 0).reverse();

  const row = (c: Countdown) => {
    const days = daysUntilKey(c.date);
    return (
      <SwipeableRow
        key={c.id}
        actions={[
          {
            label: 'Delete',
            color: colors.red,
            onPress: async () => {
              await repo.deleteCountdown(c.id);
              await load();
            },
          },
        ]}
      >
        <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', opacity: days < 0 ? 0.6 : 1 }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.headline, { color: colors.label }]}>{c.title}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{formatDateKey(c.date)}</Text>
          </View>
          <Text style={[typography.title2, { color: days < 0 ? colors.secondaryLabel : days <= 7 ? colors.orange : colors.blue }]}>
            {describeCountdown(days)}
          </Text>
        </Card>
      </SwipeableRow>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Countdowns" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {items.length === 0 ? (
          <EmptyState icon="clock.fill" title="No countdowns" message="Count down to a trip, exam, wedding or Hajj. The nearest one shows on Home." />
        ) : (
          <>
            {upcoming.map(row)}
            {past.length > 0 ? (
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginVertical: spacing.sm, textTransform: 'uppercase' }]}>Past</Text>
            ) : null}
            {past.map(row)}
          </>
        )}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New countdown</Text>
          <TextField label="What" placeholder="e.g. Umrah trip" value={title} onChangeText={setTitle} autoFocus />
          <TextField label="Date" placeholder="YYYY-MM-DD" value={dateInput} onChangeText={setDateInput} autoCapitalize="none" />
          {dateInput && !parsed ? (
            <Text style={[typography.caption1, { color: colors.red, marginTop: -spacing.sm, marginBottom: spacing.sm }]}>
              Use the format 2027-03-15
            </Text>
          ) : null}
          <View style={{ marginBottom: spacing.md }}>
            <ChipSelector
              options={QUICK}
              selectedId={null}
              onSelect={(id) => {
                const d = new Date();
                d.setDate(d.getDate() + Number(id));
                setDateInput(todayKey(d));
              }}
            />
          </View>
          <Button title="Save" onPress={save} disabled={!parsed || !title.trim()} style={{ marginBottom: spacing.xl }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}
