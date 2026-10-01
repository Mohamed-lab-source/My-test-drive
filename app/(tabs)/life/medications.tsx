import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import * as repo from '../../../src/db/repositories/health';
import { rescheduleMedicationReminders, requestNotificationPermission } from '../../../src/notifications/scheduler';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { formatClock } from '../../../src/utils/date';
import type { Medication } from '../../../src/db/types';

const TIMES = ['07:00', '08:00', '12:00', '14:00', '18:00', '20:00', '22:00'];

export default function MedicationsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);

  const load = useCallback(async () => {
    const list = await repo.listMedications();
    setMeds(list);
    await rescheduleMedicationReminders(list, repo.medicationTimes);
  }, []);
  useEffect(() => {
    repo.listMedications().then(setMeds);
  }, []);

  const save = async () => {
    if (!name.trim() || times.length === 0) return;
    if (!useSettingsStore.getState().notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) Alert.alert('Reminders are off', 'Allow notifications in your phone Settings to get medication reminders.');
    }
    await repo.createMedication(name.trim(), dose.trim() || null, [...times].sort());
    setName('');
    setDose('');
    setTimes(['08:00']);
    setAdding(false);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Medications" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {meds.length === 0 ? (
          <EmptyState icon="heart.fill" title="No medications" message="Add one to get a reminder at the times you take it." />
        ) : (
          meds.map((m) => (
            <SwipeableRow
              key={m.id}
              actions={[
                {
                  label: 'Delete',
                  color: colors.red,
                  onPress: async () => {
                    await repo.deleteMedication(m.id);
                    await load();
                  },
                },
              ]}
            >
              <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', opacity: m.is_active ? 1 : 0.55 }}>
                <Text style={{ fontSize: 24, marginRight: spacing.sm }}>💊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: colors.label }]}>{m.name}</Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                    {m.dose ? `${m.dose} · ` : ''}
                    {repo.medicationTimes(m).map(formatClock).join(', ')}
                  </Text>
                </View>
                <Switch
                  value={!!m.is_active}
                  onValueChange={async (v) => {
                    await repo.setMedicationActive(m.id, v);
                    await load();
                  }}
                />
              </Card>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Add medication</Text>
          <TextField label="Name" placeholder="e.g. Vitamin D" value={name} onChangeText={setName} autoFocus />
          <TextField label="Dose" placeholder="Optional, e.g. 1 tablet" value={dose} onChangeText={setDose} />
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Remind me at
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
            {TIMES.map((t) => {
              const on = times.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => setTimes((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radius.md,
                    marginRight: 8,
                    marginBottom: 8,
                    backgroundColor: on ? colors.blue : colors.tertiaryFill,
                  }}
                >
                  <Text style={[typography.subhead, { color: on ? '#fff' : colors.label }]}>{formatClock(t)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button title="Save" onPress={save} disabled={!name.trim() || times.length === 0} style={{ marginBottom: spacing.xl }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}
