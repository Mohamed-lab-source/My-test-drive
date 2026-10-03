import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { todayKey } from '../../../src/db/client';
import type { Task } from '../../../src/db/types';

// Urgent = due today/overdue or already in progress; important = high priority.
const isUrgent = (t: Task, today: string) => t.status === 'in_progress' || (!!t.scheduled_date && t.scheduled_date <= today);
const isImportant = (t: Task) => t.priority === 'high';

export default function MatrixScreen() {
  const { colors, typography, spacing } = useTheme();
  const { tasks, toggleTaskDone } = useProductivityStore();
  const today = todayKey();
  const open = tasks.filter((t) => t.status !== 'done');

  const quadrants = [
    { title: 'Do now', hint: 'Urgent & important', color: colors.red, items: open.filter((t) => isUrgent(t, today) && isImportant(t)) },
    { title: 'Schedule', hint: 'Important, not urgent', color: colors.blue, items: open.filter((t) => !isUrgent(t, today) && isImportant(t)) },
    { title: 'Quick wins', hint: 'Urgent, less important', color: colors.orange, items: open.filter((t) => isUrgent(t, today) && !isImportant(t)) },
    { title: 'Later', hint: 'Neither — or drop it', color: colors.gray, items: open.filter((t) => !isUrgent(t, today) && !isImportant(t)) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Priority matrix" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {quadrants.map((q) => (
            <View key={q.title} style={{ width: '50%', padding: 4 }}>
              <Card style={{ minHeight: 200, borderTopWidth: 4, borderTopColor: q.color }}>
                <Text style={[typography.headline, { color: colors.label }]}>
                  {q.title} <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}>{q.items.length}</Text>
                </Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>{q.hint}</Text>
                {q.items.slice(0, 8).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleTaskDone(t.id, true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 }}
                  >
                    <Icon name="circle" size={16} color={q.color} />
                    <Text style={[typography.footnote, { color: colors.label, marginLeft: 6, flex: 1 }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                  </Pressable>
                ))}
                {q.items.length > 8 ? (
                  <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>+{q.items.length - 8} more</Text>
                ) : null}
              </Card>
            </View>
          ))}
        </View>
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.sm }]}>
          Tap a task to complete it. Set a task to High priority to make it “important”; scheduling it for today makes it “urgent”.
        </Text>
      </ScrollView>
    </View>
  );
}
