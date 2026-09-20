import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { useProductivityStore } from '../../store/productivityStore';
import type { Task } from '../../db/types';

export function TaskRow({ task, isLast }: { task: Task; isLast?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  const toggleTaskDone = useProductivityStore((s) => s.toggleTaskDone);
  const removeTask = useProductivityStore((s) => s.removeTask);
  const project = useProductivityStore((s) => s.projects.find((p) => p.id === task.project_id));

  const isDone = task.status === 'done';
  const priorityColor =
    task.priority === 'high' ? colors.red : task.priority === 'medium' ? colors.orange : colors.gray;

  return (
    <SwipeableRow actions={[{ label: 'Delete', color: colors.red, onPress: () => removeTask(task.id) }]}>
      <View
        style={[
          styles.row,
          {
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderBottomColor: colors.separator,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleTaskDone(task.id, !isDone);
          }}
          hitSlop={8}
          style={{ marginRight: spacing.sm }}
        >
          <Icon name={isDone ? 'checkmark.circle.fill' : 'circle'} size={24} color={isDone ? colors.green : colors.gray3} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.body,
              { color: isDone ? colors.secondaryLabel : colors.label, textDecorationLine: isDone ? 'line-through' : 'none' },
            ]}
          >
            {task.title}
          </Text>
          {project ? (
            <Text style={[typography.caption1, { color: project.color, marginTop: 2, fontWeight: '600' }]}>{project.name}</Text>
          ) : null}
        </View>
        {!isDone && task.priority !== 'low' ? (
          <Badge text={task.priority === 'high' ? 'High' : 'Medium'} color={priorityColor} />
        ) : null}
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
