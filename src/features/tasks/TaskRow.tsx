import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { showUndoDelete } from '../../ui/undo';
import { useProductivityStore } from '../../store/productivityStore';
import type { Task } from '../../db/types';

interface TaskRowProps {
  task: Task;
  isLast?: boolean;
  onPress?: () => void;
  reorder?: { canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void };
}

export function TaskRow({ task, isLast, onPress, reorder }: TaskRowProps) {
  const { colors, typography, spacing } = useTheme();
  const toggleTaskDone = useProductivityStore((s) => s.toggleTaskDone);
  const removeTask = useProductivityStore((s) => s.removeTask);
  const refreshTasks = useProductivityStore((s) => s.refreshTasks);
  const project = useProductivityStore((s) => s.projects.find((p) => p.id === task.project_id));

  const handleDelete = async () => {
    await removeTask(task.id);
    showUndoDelete('tasks', task, 'Task deleted', refreshTasks);
  };

  const isDone = task.status === 'done';
  const priorityColor =
    task.priority === 'high' ? colors.red : task.priority === 'medium' ? colors.orange : colors.gray;

  return (
    <SwipeableRow actions={[{ label: 'Delete', color: colors.red, onPress: handleDelete }]}>
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
        <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={onPress} disabled={!onPress}>
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
        </Pressable>
        {reorder ? (
          <View style={{ marginLeft: spacing.sm }}>
            <Pressable onPress={reorder.onMoveUp} disabled={!reorder.canMoveUp} hitSlop={6}>
              <Icon name="arrow.up" size={14} color={reorder.canMoveUp ? colors.secondaryLabel : colors.tertiaryLabel} />
            </Pressable>
            <Pressable onPress={reorder.onMoveDown} disabled={!reorder.canMoveDown} hitSlop={6}>
              <Icon name="arrow.down" size={14} color={reorder.canMoveDown ? colors.secondaryLabel : colors.tertiaryLabel} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
