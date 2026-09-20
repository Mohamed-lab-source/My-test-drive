import React, { useMemo } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { Card } from '../../../../src/ui/Card';
import { Button } from '../../../../src/ui/Button';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { computeCurrentStreak, computeLongestStreak, weekdayBreakdown } from '../../../../src/domain/habits/analytics';
import { WEEKDAY_LABELS } from '../../../../src/domain/habits/dateUtils';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing, radius } = useTheme();
  const router = useRouter();
  const { habits, checkins, identities, archiveHabit, deleteHabit } = useHabitsStore();

  const habit = habits.find((h) => h.id === id);
  const identity = identities.find((i) => i.id === habit?.identityId);

  const currentStreak = useMemo(() => (habit ? computeCurrentStreak(habit, checkins) : 0), [habit, checkins]);
  const longestStreak = useMemo(() => (habit ? computeLongestStreak(habit, checkins) : 0), [habit, checkins]);
  const weekdayStats = useMemo(() => (habit ? weekdayBreakdown(habit, checkins) : []), [habit, checkins]);

  if (!habit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Habit" />
      </View>
    );
  }

  const maxRate = Math.max(0.01, ...weekdayStats.map((s) => s.rate));

  const handleArchive = () => {
    Alert.alert('Archive habit', `Stop tracking "${habit.name}"? Its history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: async () => { await archiveHabit(habit.id); router.back(); } },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete habit', `Permanently delete "${habit.name}" and all its history? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteHabit(habit.id); router.back(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title={habit.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Card style={{ alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: 40 }}>{habit.icon}</Text>
          <Text style={[typography.title2, { color: colors.label, marginTop: spacing.xs }]}>{habit.name}</Text>
          {identity ? (
            <Text style={[typography.subhead, { color: colors.purple, marginTop: 2 }]}>for becoming {identity.statement}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <View style={{ alignItems: 'center', marginHorizontal: spacing.lg }}>
              <Text style={[typography.title1, { color: colors.orange }]}>🔥 {currentStreak}</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Current streak</Text>
            </View>
            <View style={{ alignItems: 'center', marginHorizontal: spacing.lg }}>
              <Text style={[typography.title1, { color: colors.label }]}>{longestStreak}</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Best streak</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>By weekday</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90 }}>
            {weekdayStats.map((stat) => (
              <View key={stat.weekday} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 18,
                    height: Math.max(4, (stat.rate / maxRate) * 70),
                    borderRadius: radius.sm,
                    backgroundColor: colors.blue,
                  }}
                />
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  {WEEKDAY_LABELS[stat.weekday]}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>The Four Laws</Text>
          {[
            ['Cue', habit.cue],
            ['Craving', habit.craving],
            ['Response', habit.response],
            ['Reward', habit.reward],
          ].map(([label, value]) => (
            <View key={label} style={{ marginBottom: spacing.sm }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, textTransform: 'uppercase' }]}>{label}</Text>
              <Text style={[typography.body, { color: colors.label }]}>{value || '—'}</Text>
            </View>
          ))}
          {habit.twoMinuteVersion ? (
            <View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, textTransform: 'uppercase' }]}>
                Two-minute version
              </Text>
              <Text style={[typography.body, { color: colors.label }]}>{habit.twoMinuteVersion}</Text>
            </View>
          ) : null}
        </Card>

        <Button title="Archive habit" variant="secondary" onPress={handleArchive} style={{ marginBottom: spacing.sm }} />
        <Button title="Delete habit" variant="destructive" onPress={handleDelete} />
      </ScrollView>
    </View>
  );
}
