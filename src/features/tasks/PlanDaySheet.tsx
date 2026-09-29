import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import { todayKey } from '../../db/client';
import { formatDateKey } from '../../utils/date';

// Pick tasks from the backlog (and anything unscheduled) to work on today.
export function PlanDaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { tasks, projects, rescheduleTask } = useProductivityStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const today = todayKey();

  const candidates = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'backlog' || (t.status === 'todo' && t.scheduled_date !== today))
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]),
    [tasks, today]
  );
  const plannedCount = tasks.filter((t) => t.status !== 'done' && t.scheduled_date === today).length;

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      for (const id of picked) await rescheduleTask(id, 'today');
      setPicked([]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        <Text style={[typography.title2, { color: colors.label }]}>Plan my day</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          {plannedCount + picked.length} task{plannedCount + picked.length === 1 ? '' : 's'} for today. Pick a few — three to five
          is a good day.
        </Text>
        {candidates.length === 0 ? (
          <Text style={[typography.body, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
            Your backlog is empty — nothing waiting to be planned.
          </Text>
        ) : (
          candidates.map((t) => {
            const on = picked.includes(t.id);
            const project = projects.find((p) => p.id === t.project_id);
            return (
              <Pressable
                key={t.id}
                onPress={() => toggle(t.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}
              >
                <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? colors.blue : colors.gray3} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.body, { color: colors.label }]}>{t.title}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                    {t.status === 'backlog' ? 'Backlog' : t.scheduled_date ? `Planned for ${formatDateKey(t.scheduled_date)}` : 'Unscheduled'}
                    {project ? ` · ${project.name}` : ''}
                    {t.priority === 'high' ? ' · High priority' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
        <Button
          title={picked.length ? `Add ${picked.length} to today` : 'Done'}
          onPress={picked.length ? handleDone : onClose}
          loading={saving}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </Sheet>
  );
}
