import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { useHabitsStore } from '../../store/habitsStore';
import { computeCurrentStreak, findCheckIn, isVote } from '../../domain/habits/analytics';
import { todayISO } from '../../domain/habits/dateUtils';
import type { Habit } from '../../domain/habits/types';

export function HabitTodayRow({ habit, isLast }: { habit: Habit; isLast?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { checkins, setCheckIn, clearCheckIn } = useHabitsStore();
  const today = todayISO();

  const checkin = findCheckIn(checkins, habit.id, today);
  const done = isVote(checkin);
  const usedTwoMin = checkin?.usedTwoMinuteVersion ?? false;
  const streak = computeCurrentStreak(habit, checkins);

  const toggleFull = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (checkin?.completedFull) {
      clearCheckIn(habit.id, today);
    } else {
      setCheckIn(habit.id, today, { completedFull: true, usedTwoMinuteVersion: false, skipped: false, frozen: false });
    }
  };

  const toggleTwoMin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (usedTwoMin) {
      clearCheckIn(habit.id, today);
    } else {
      setCheckIn(habit.id, today, { usedTwoMinuteVersion: true, completedFull: false, skipped: false, frozen: false });
    }
  };

  return (
    <SwipeableRow
      actions={[
        {
          label: 'Skip',
          color: colors.gray,
          onPress: () => setCheckIn(habit.id, today, { skipped: true, completedFull: false, usedTwoMinuteVersion: false, frozen: false }),
        },
        {
          label: 'Freeze',
          color: colors.teal,
          onPress: () => setCheckIn(habit.id, today, { frozen: true, completedFull: false, usedTwoMinuteVersion: false, skipped: false }),
        },
      ]}
    >
      <Pressable
        onPress={() => router.push(`/life/habits/${habit.id}`)}
        style={[
          styles.row,
          { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomColor: colors.separator, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
        ]}
      >
        <Text style={{ fontSize: 26, marginRight: spacing.sm }}>{habit.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { color: colors.label }]} numberOfLines={1}>
            {habit.name}
          </Text>
          {streak > 0 ? (
            <Text style={[typography.caption1, { color: colors.orange, marginTop: 2 }]}>🔥 {streak}-day streak</Text>
          ) : (
            <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>{habit.timeOfDay}</Text>
          )}
        </View>
        {!done ? (
          <Pressable
            onPress={toggleTwoMin}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: colors.fill,
              marginRight: spacing.sm,
            }}
          >
            <Text style={[typography.caption1, { color: colors.secondaryLabel, fontWeight: '600' }]}>2 min</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={toggleFull}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? colors.green : colors.fill,
          }}
        >
          <Text style={{ fontSize: 16 }}>{done ? '✓' : ''}</Text>
        </Pressable>
      </Pressable>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
