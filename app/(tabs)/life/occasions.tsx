import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Button } from '../../../src/ui/Button';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { useUndoStore } from '../../../src/store/undoStore';
import * as repo from '../../../src/db/repositories/occasions';
import { insertRow } from '../../../src/db/helpers';
import { daysUntilAnnual } from '../../../src/utils/date';
import { cancelOccasionReminder, scheduleOccasionReminder } from '../../../src/notifications/scheduler';
import type { Occasion, OccasionKind } from '../../../src/db/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KINDS: { id: OccasionKind; label: string; icon: string }[] = [
  { id: 'birthday', label: 'Birthday', icon: 'gift.fill' },
  { id: 'anniversary', label: 'Anniversary', icon: 'heart.fill' },
  { id: 'other', label: 'Other', icon: 'star.fill' },
];

// Uses a leap year so Feb 29 is allowed.
const daysInMonth = (month: number) => new Date(2024, month, 0).getDate();

function AddOccasionSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OccasionKind>('birthday');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState('');
  const [saving, setSaving] = useState(false);

  const dayNum = Number(day);
  const canSave = name.trim().length > 0 && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= daysInMonth(month);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const occasion = await repo.createOccasion({ name: name.trim(), kind, month, day: dayNum });
      await scheduleOccasionReminder(occasion);
      setName('');
      setDay('');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = [typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' as const }];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New Occasion</Text>
        <TextField label="Name" placeholder="e.g. Mom, Our wedding" value={name} onChangeText={setName} autoFocus />
        <Text style={labelStyle}>Type</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={KINDS} selectedId={kind} onSelect={(id) => setKind(id as OccasionKind)} />
        </View>
        <Text style={labelStyle}>Month</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector
            options={MONTHS.map((m, i) => ({ id: String(i + 1), label: m }))}
            selectedId={String(month)}
            onSelect={(id) => setMonth(Number(id))}
          />
        </View>
        <TextField label={`Day (1–${daysInMonth(month)})`} placeholder="e.g. 14" keyboardType="number-pad" value={day} onChangeText={setDay} />
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginBottom: spacing.xl }} />
      </ScrollView>
    </Sheet>
  );
}

export default function OccasionsScreen() {
  const { colors, typography, spacing } = useTheme();
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [addVisible, setAddVisible] = useState(false);

  const load = useCallback(() => repo.listOccasions().then(setOccasions), []);
  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(
    () => occasions.map((o) => ({ o, days: daysUntilAnnual(o.month, o.day) })).sort((a, b) => a.days - b.days),
    [occasions]
  );

  const handleDelete = async (o: Occasion) => {
    await repo.deleteOccasion(o.id);
    await cancelOccasionReminder(o.id);
    await load();
    useUndoStore.getState().show(`${o.name} removed`, async () => {
      await insertRow('occasions', o as unknown as Record<string, unknown>);
      await scheduleOccasionReminder(o);
      await load();
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Occasions" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {upcoming.length === 0 ? (
          <EmptyState icon="gift.fill" title="No occasions yet" message="Add birthdays and anniversaries to get a reminder on the day." />
        ) : (
          <Card padded={false}>
            {upcoming.map(({ o, days }, i) => {
              const k = KINDS.find((x) => x.id === o.kind)!;
              return (
                <SwipeableRow key={o.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(o) }]}>
                  <ListRow
                    isLast={i === upcoming.length - 1}
                    leading={<IconCircle name={k.icon} color={o.kind === 'birthday' ? colors.pink : colors.red} />}
                    title={o.name}
                    subtitle={`${MONTHS[o.month - 1]} ${o.day} · ${k.label}`}
                    trailing={
                      <Text style={[typography.subhead, { color: days === 0 ? colors.green : colors.secondaryLabel, fontWeight: days <= 7 ? '700' : '400' }]}>
                        {days === 0 ? 'Today 🎉' : days === 1 ? 'Tomorrow' : `in ${days} days`}
                      </Text>
                    }
                  />
                </SwipeableRow>
              );
            })}
          </Card>
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddOccasionSheet visible={addVisible} onClose={() => setAddVisible(false)} onSaved={load} />
    </View>
  );
}
