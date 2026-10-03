import React from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { useProductivityStore } from '../../../src/store/productivityStore';
import type { Task, TaskStatus } from '../../../src/db/types';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

export default function BoardScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const { tasks, projects, updateTask, toggleTaskDone, rescheduleTask } = useProductivityStore();
  const columnWidth = Math.min(300, width * 0.78);

  const move = async (task: Task, to: TaskStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Going in or out of Done runs through toggleTaskDone so repeating tasks
    // spawn (or retract) their next occurrence as usual.
    if (to === 'done') return toggleTaskDone(task.id, true);
    if (task.status === 'done') await toggleTaskDone(task.id, false);
    if (to === 'backlog') return rescheduleTask(task.id, 'backlog');
    await updateTask(task.id, { status: to });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Board" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingRight: spacing.xl }}>
        {COLUMNS.map((col, ci) => {
          const items = tasks
            .filter((t) => t.status === col.status)
            .slice(0, col.status === 'done' ? 30 : undefined);
          return (
            <View
              key={col.status}
              style={{
                width: columnWidth,
                marginRight: spacing.md,
                backgroundColor: colors.tertiaryFill,
                borderRadius: radius.lg,
                padding: spacing.sm,
              }}
            >
              <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm, marginLeft: 4 }]}>
                {col.label} <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}>{items.length}</Text>
              </Text>
              <ScrollView style={{ maxHeight: 560 }} nestedScrollEnabled>
                {items.length === 0 ? (
                  <Text style={[typography.footnote, { color: colors.tertiaryLabel, margin: 4 }]}>Nothing here</Text>
                ) : (
                  items.map((t) => {
                    const project = projects.find((p) => p.id === t.project_id);
                    const prev = COLUMNS[ci - 1];
                    const next = COLUMNS[ci + 1];
                    return (
                      <Card key={t.id} style={{ marginBottom: spacing.sm, padding: spacing.sm }}>
                        <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]} numberOfLines={3}>
                          {t.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          {project ? (
                            <Text style={[typography.caption1, { color: project.color, flex: 1 }]} numberOfLines={1}>
                              {project.name}
                            </Text>
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}
                          {prev ? (
                            <Pressable onPress={() => move(t, prev.status)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                              <Icon name="chevron.left" size={20} color={colors.blue} />
                            </Pressable>
                          ) : null}
                          {next ? (
                            <Pressable onPress={() => move(t, next.status)} hitSlop={8} style={{ marginLeft: spacing.md }}>
                              <Icon name="chevron.right" size={20} color={colors.blue} />
                            </Pressable>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
