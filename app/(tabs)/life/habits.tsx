import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useHabitsStore } from '../../../src/store/habitsStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Icon } from '../../../src/ui/Icon';
import { Heatmap } from '../../../src/ui/Heatmap';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import { AddHabitSheet } from '../../../src/features/life/AddHabitSheet';
import * as habitsRepo from '../../../src/db/repositories/habits';
import { todayKey } from '../../../src/db/client';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { HABIT_REMINDER_TIMES, requestNotificationPermission } from '../../../src/notifications/scheduler';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { formatClock } from '../../../src/utils/date';
import type { Habit } from '../../../src/db/types';

const WEEKS = 5;

function HabitCard({ habit, onDelete }: { habit: Habit; onDelete: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { streaks, todayLogs, isHabitDoneToday, toggleHabit, setHabitReminder } = useHabitsStore();
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Record<string, number>>({});

  const done = isHabitDoneToday(habit.id);
  const streak = streaks[habit.id] ?? 0;

  useEffect(() => {
    if (!expanded) return;
    const since = new Date();
    since.setDate(since.getDate() - WEEKS * 7);
    habitsRepo
      .listHabitLogsSince(habit.id, todayKey(since))
      .then((logs) => setHistory(Object.fromEntries(logs.map((l) => [l.date, 1]))));
  }, [expanded, todayLogs, habit.id]);

  return (
    <SwipeableRow actions={[{ label: 'Delete', color: colors.red, onPress: onDelete }]}>
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => setExpanded((e) => !e)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <IconCircle name={habit.icon} color={habit.color} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.headline, { color: colors.label }]}>{habit.name}</Text>
              {streak > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Icon name="flame.fill" size={13} color={colors.orange} />
                  <Text style={[typography.caption1, { color: colors.orange, marginLeft: 3 }]}>
                    {streak} day{streak === 1 ? '' : 's'} streak
                  </Text>
                </View>
              ) : (
                <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>Tap to see history</Text>
              )}
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleHabit(habit.id, !done);
            }}
            hitSlop={8}
          >
            <Icon name={done ? 'checkmark.circle.fill' : 'circle'} size={28} color={done ? colors.green : colors.gray3} />
          </Pressable>
        </View>
        {expanded ? (
          <View style={{ marginTop: spacing.md }}>
            <Heatmap values={history} color={habit.color} weeks={WEEKS} />
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: 6 }]}>
              Daily reminder
            </Text>
            <ChipSelector
              options={[{ id: 'none', label: 'None' }, ...HABIT_REMINDER_TIMES.map((t) => ({ id: t, label: formatClock(t) }))]}
              selectedId={habit.remind_time ?? 'none'}
              onSelect={async (id) => {
                if (id !== 'none' && !useSettingsStore.getState().notificationsEnabled) await requestNotificationPermission();
                setHabitReminder(habit.id, id === 'none' ? null : id);
              }}
            />
          </View>
        ) : null}
      </Card>
    </SwipeableRow>
  );
}

export default function HabitsScreen() {
  const { colors, spacing } = useTheme();
  const { habits, removeHabit, hydrate } = useHabitsStore();
  const [addVisible, setAddVisible] = useState(false);

  const handleDelete = async (habit: Habit) => {
    await removeHabit(habit.id);
    showUndoDelete('habits', habit, 'Habit deleted', hydrate);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Habits" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {habits.length === 0 ? (
          <EmptyState icon="flame.fill" title="No habits yet" message="Track anything you want to do daily and build a streak." />
        ) : (
          habits.map((habit) => <HabitCard key={habit.id} habit={habit} onDelete={() => handleDelete(habit)} />)
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddHabitSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
