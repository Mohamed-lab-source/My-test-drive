import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { useProductivityStore } from '../../../src/store/productivityStore';
import * as repo from '../../../src/db/repositories/lists';
import { todayKey } from '../../../src/db/client';
import type { Routine } from '../../../src/db/types';

export default function RoutinesScreen() {
  const { colors, typography, spacing } = useTheme();
  const addTask = useProductivityStore((s) => s.addTask);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [itemsText, setItemsText] = useState('');

  const load = useCallback(() => repo.listRoutines().then(setRoutines), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const items = itemsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!name.trim() || items.length === 0) return;
    await repo.createRoutine(name.trim(), items);
    setName('');
    setItemsText('');
    setAdding(false);
    await load();
  };

  const run = async (r: Routine) => {
    const items = repo.routineItems(r);
    let order = Date.now();
    for (const title of items) {
      await addTask({
        project_id: null,
        title,
        notes: null,
        status: 'todo',
        priority: 'medium',
        due_date: null,
        scheduled_date: todayKey(),
        sort_order: order++,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added to today', `${items.length} task${items.length === 1 ? '' : 's'} from "${r.name}".`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Routines" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {routines.length === 0 ? (
          <EmptyState
            icon="list.bullet"
            title="No routines yet"
            message="Save a list you do often — a morning routine, weekly cleaning, trip packing — and add it to today in one tap."
          />
        ) : (
          routines.map((r) => {
            const items = repo.routineItems(r);
            return (
              <SwipeableRow
                key={r.id}
                actions={[
                  {
                    label: 'Delete',
                    color: colors.red,
                    onPress: async () => {
                      await repo.deleteRoutine(r.id);
                      await load();
                    },
                  },
                ]}
              >
                <Card style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.headline, { color: colors.label }]}>{r.name}</Text>
                  {items.slice(0, 6).map((it, i) => (
                    <Text key={i} style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                      • {it}
                    </Text>
                  ))}
                  {items.length > 6 ? (
                    <Text style={[typography.footnote, { color: colors.tertiaryLabel, marginTop: 2 }]}>+{items.length - 6} more</Text>
                  ) : null}
                  <Button title="Add to today" variant="secondary" onPress={() => run(r)} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }} />
                </Card>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>New routine</Text>
          <TextField label="Name" placeholder="e.g. Friday prep" value={name} onChangeText={setName} autoFocus />
          <TextField
            label="Tasks — one per line"
            placeholder={'Ghusl\nRead Surat al-Kahf\nSend salawat'}
            value={itemsText}
            onChangeText={setItemsText}
            multiline
            style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 12 }}
          />
          <Button title="Save" onPress={save} disabled={!name.trim() || !itemsText.trim()} style={{ marginBottom: spacing.xl }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}
