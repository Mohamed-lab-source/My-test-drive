import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import type { Task } from '../../db/types';

export const STALE_DAYS = 30;

export function staleBacklog(tasks: Task[], now = Date.now()): Task[] {
  return tasks.filter((t) => t.status === 'backlog' && now - new Date(t.created_at).getTime() > STALE_DAYS * 86400000);
}

// Old backlog items, one at a time: do it today, or let it go.
export function StaleBacklogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { tasks, rescheduleTask, removeTask } = useProductivityStore();
  const stale = staleBacklog(tasks);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <Text style={[typography.title2, { color: colors.label }]}>Tidy your backlog</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          These have waited more than {STALE_DAYS} days. Pull one into today, or delete what no longer matters.
        </Text>
        {stale.length === 0 ? (
          <Text style={[typography.body, { color: colors.green }]}>All tidy ✓</Text>
        ) : (
          stale.map((t) => (
            <View key={t.id} style={{ paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
              <Text style={[typography.body, { color: colors.label }]}>{t.title}</Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                <Button title="Today" variant="secondary" onPress={() => rescheduleTask(t.id, 'today')} style={{ flex: 1, marginRight: spacing.sm }} />
                <Button title="Delete" variant="destructive" onPress={() => removeTask(t.id)} style={{ flex: 1 }} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}
