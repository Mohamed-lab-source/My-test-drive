import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useHabitsStore } from '../../../src/store/habitsStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Icon } from '../../../src/ui/Icon';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import { AddHabitSheet } from '../../../src/features/life/AddHabitSheet';

export default function HabitsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { habits, streaks, isHabitDoneToday, toggleHabit, removeHabit, hydrate } = useHabitsStore();
  const [addVisible, setAddVisible] = useState(false);

  const handleDelete = async (habit: (typeof habits)[number]) => {
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
          habits.map((habit) => {
            const done = isHabitDoneToday(habit.id);
            const streak = streaks[habit.id] ?? 0;
            return (
              <SwipeableRow key={habit.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(habit) }]}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
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
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleHabit(habit.id, !done);
                    }}
                    hitSlop={8}
                  >
                    <Icon name={done ? 'checkmark.circle.fill' : 'circle'} size={28} color={done ? colors.green : colors.gray3} />
                  </Pressable>
                </Card>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddHabitSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
