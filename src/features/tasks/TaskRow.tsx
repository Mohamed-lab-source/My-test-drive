import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ActionMenu } from '../../ui/ActionMenu';
import * as Haptics from '../../utils/haptics';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { PressableScale } from '../../ui/PressableScale';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { showUndoDelete } from '../../ui/undo';
import { useProductivityStore } from '../../store/productivityStore';
import { daysToDeadline, deadlineLabel, formatEstimate } from '../../utils/estimate';
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
  const rescheduleTask = useProductivityStore((s) => s.rescheduleTask);
  const updateTask = useProductivityStore((s) => s.updateTask);

  // Long-press: the common actions without opening the task.
  const [menuOpen, setMenuOpen] = useState(false);
  const quickMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuOpen(true);
  };
  const project = useProductivityStore((s) => s.projects.find((p) => p.id === task.project_id));
  const subtasks = useProductivityStore((s) => s.subtaskCounts[task.id]);

  const handleDelete = async () => {
    await removeTask(task.id);
    showUndoDelete('tasks', task, 'Task deleted', refreshTasks);
  };

  const isDone = task.status === 'done';
  const priorityColor =
    task.priority === 'high' ? colors.red : task.priority === 'medium' ? colors.orange : colors.gray;

  return (
    <SwipeableRow
      actions={[
        ...(isDone ? [] : [{ label: 'Tomorrow', color: colors.orange, onPress: () => rescheduleTask(task.id, 'tomorrow') }]),
        { label: 'Delete', color: colors.red, onPress: handleDelete },
      ]}
    >
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
        <PressableScale
          haptic="none"
          scaleTo={0.75}
          onPress={() => {
            if (isDone) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toggleTaskDone(task.id, !isDone);
          }}
          hitSlop={8}
          style={{ marginRight: spacing.sm }}
        >
          {isDone ? (
            <Animated.View key="done" entering={ZoomIn.springify().damping(12).stiffness(260)}>
              <Icon name="checkmark.circle.fill" size={25} color={colors.green} />
            </Animated.View>
          ) : (
            <Icon name="circle" size={25} color={colors.gray3} />
          )}
        </PressableScale>
        <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={onPress} onLongPress={quickMenu} delayLongPress={350}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.body,
                { color: isDone ? colors.secondaryLabel : colors.label, textDecorationLine: isDone ? 'line-through' : 'none' },
              ]}
            >
              {task.title}
            </Text>
            {project || subtasks || task.estimate_minutes || task.due_date || task.waiting_on ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                {project ? (
                  <Text style={[typography.caption1, { color: project.color, fontWeight: '600', marginRight: spacing.sm }]}>
                    {project.name}
                  </Text>
                ) : null}
                {task.due_date && !isDone ? (
                  <Text
                    style={[
                      typography.caption1,
                      { color: daysToDeadline(task.due_date) < 0 ? colors.red : daysToDeadline(task.due_date) <= 1 ? colors.orange : colors.secondaryLabel, marginRight: spacing.sm, fontWeight: '600' },
                    ]}
                  >
                    📅 {deadlineLabel(task.due_date)}
                  </Text>
                ) : null}
                {task.waiting_on && !isDone ? (
                  <Text style={[typography.caption1, { color: colors.purple, marginRight: spacing.sm }]}>⏳ {task.waiting_on}</Text>
                ) : null}
                {task.estimate_minutes ? (
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginRight: spacing.sm }]}>
                    ⏱ {formatEstimate(task.estimate_minutes)}
                  </Text>
                ) : null}
                {subtasks ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon
                      name="checklist"
                      size={12}
                      color={subtasks.done === subtasks.total ? colors.green : colors.secondaryLabel}
                    />
                    <Text
                      style={[
                        typography.caption1,
                        { color: subtasks.done === subtasks.total ? colors.green : colors.secondaryLabel, marginLeft: 3 },
                      ]}
                    >
                      {subtasks.done}/{subtasks.total}
                    </Text>
                  </View>
                ) : null}
              </View>
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
      <ActionMenu
        visible={menuOpen}
        title={task.title}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: isDone ? 'Mark not done' : 'Mark done', onPress: () => toggleTaskDone(task.id, !isDone) },
          ...(isDone
            ? []
            : [
                { label: 'Do today', onPress: () => rescheduleTask(task.id, 'today') },
                { label: 'Tomorrow', onPress: () => rescheduleTask(task.id, 'tomorrow') },
                { label: 'Next week', onPress: () => rescheduleTask(task.id, 'next_week') },
                {
                  label: task.priority === 'high' ? 'Lower priority' : 'Make high priority',
                  onPress: () => updateTask(task.id, { priority: task.priority === 'high' ? 'medium' : 'high' }),
                },
              ]),
          { label: 'Delete', destructive: true, onPress: handleDelete },
        ]}
      />
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
