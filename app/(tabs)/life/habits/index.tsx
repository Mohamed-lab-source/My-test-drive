import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { Card } from '../../../../src/ui/Card';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { FAB } from '../../../../src/ui/FAB';
import { IconCircle } from '../../../../src/ui/IconCircle';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { LevelHeader } from '../../../../src/features/habits/LevelHeader';
import { QuoteOfTheDayCard, ChallengeOfTheDayCard, CorrelationInsightCard } from '../../../../src/features/habits/DailyCards';
import { HabitTodayRow } from '../../../../src/features/habits/HabitTodayRow';
import { isDue, todayISO } from '../../../../src/domain/habits/dateUtils';

function QuickLink({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.secondarySystemGroupedBackground,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
        marginHorizontal: 4,
      }}
    >
      <IconCircle name={icon} color={color} size={40} />
      <Text style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export default function HabitsTodayScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { habits } = useHabitsStore();

  const today = todayISO();
  const dueToday = useMemo(
    () => habits.filter((h) => !h.archived && isDue(h.frequency, today)).sort((a, b) => a.sortOrder - b.sortOrder),
    [habits, today]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Habits" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ marginBottom: spacing.md }}>
          <LevelHeader />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <QuoteOfTheDayCard />
        </View>
        <View style={{ marginBottom: spacing.md }}>
          <ChallengeOfTheDayCard />
        </View>
        <View style={{ marginBottom: spacing.md }}>
          <CorrelationInsightCard />
        </View>

        <View style={{ flexDirection: 'row', marginBottom: spacing.md, marginHorizontal: -4 }}>
          <QuickLink icon="person.2.fill" label="Identities" color={colors.purple} onPress={() => router.push('/life/habits/identities')} />
          <QuickLink icon="star.fill" label="Achievements" color={colors.yellow} onPress={() => router.push('/life/habits/achievements')} />
          <QuickLink icon="doc.text.fill" label="Scorecard" color={colors.blue} onPress={() => router.push('/life/habits/scorecard')} />
        </View>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Today</Text>
        {dueToday.length === 0 ? (
          <Card>
            <EmptyState icon="sparkles" title="No habits yet" message="Design your first habit around the Four Laws." />
          </Card>
        ) : (
          <Card padded={false}>
            {dueToday.map((habit, i, arr) => (
              <HabitTodayRow key={habit.id} habit={habit} isLast={i === arr.length - 1} />
            ))}
          </Card>
        )}
      </ScrollView>
      <FAB onPress={() => router.push('/life/habits/add')} />
    </View>
  );
}
