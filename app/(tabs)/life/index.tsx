import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useLifeStore } from '../../../src/store/lifeStore';
import { useHabitsStore } from '../../../src/store/habitsStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { Card } from '../../../src/ui/Card';
import { ProgressRing } from '../../../src/ui/ProgressRing';
import { Icon } from '../../../src/ui/Icon';
import { PrayerTracker } from '../../../src/features/life/PrayerTracker';
import { WishlistRow } from '../../../src/features/life/WishlistRow';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatMoney } from '../../../src/utils/money';
import { isDue, todayISO } from '../../../src/domain/habits/dateUtils';
import { computeCurrentStreak, findCheckIn, isVote } from '../../../src/domain/habits/analytics';
import { levelForXP, computeXP } from '../../../src/domain/habits/gamification';

export default function LifeScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savingsGoals } = useFinanceStore();
  const { wishlist } = useLifeStore();
  const { habits, checkins } = useHabitsStore();

  const topGoal = savingsGoals.find((g) => !g.is_completed) ?? savingsGoals[0];
  const activeIdeas = wishlist.filter((w) => w.status !== 'purchased' && w.status !== 'dropped');

  const today = todayISO();
  const activeHabits = habits.filter((h) => !h.archived);
  const dueToday = activeHabits.filter((h) => isDue(h.frequency, today));
  const doneToday = dueToday.filter((h) => isVote(findCheckIn(checkins, h.id, today)));
  const bestStreak = useMemo(
    () => activeHabits.reduce((max, h) => Math.max(max, computeCurrentStreak(h, checkins)), 0),
    [activeHabits, checkins]
  );
  const level = useMemo(() => levelForXP(computeXP(checkins)), [checkins]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader title="Life" subtitle="Faith, goals & ideas" />

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PrayerTracker />
        </View>

        {topGoal ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Pressable onPress={() => router.push('/money/savings')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing
                  progress={topGoal.target_amount > 0 ? topGoal.current_amount / topGoal.target_amount : 0}
                  color={topGoal.color}
                  size={56}
                />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Savings goal</Text>
                  <Text style={[typography.headline, { color: colors.label }]}>{topGoal.name}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                    {formatMoney(topGoal.current_amount, topGoal.currency)} of {formatMoney(topGoal.target_amount, topGoal.currency)}
                  </Text>
                </View>
                <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
              </Card>
            </Pressable>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title3, { color: colors.label }]}>Habits</Text>
            <Pressable onPress={() => router.push('/life/habits')}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Open</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/life/habits')}>
            {activeHabits.length === 0 ? (
              <Card>
                <EmptyState
                  icon="sparkles"
                  title="Build your identity, one habit at a time"
                  message="Design habits around the Four Laws, stack them, and track streaks — powered by Atomic."
                />
              </Card>
            ) : (
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing
                  progress={dueToday.length === 0 ? 0 : doneToday.length / dueToday.length}
                  color={colors.indigo}
                  size={56}
                  label={`${doneToday.length}/${dueToday.length}`}
                />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.headline, { color: colors.label }]}>
                    Level {level.level} · {level.title}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                    {doneToday.length} of {dueToday.length} done today
                  </Text>
                  {bestStreak > 0 ? (
                    <Text style={[typography.caption1, { color: colors.orange, marginTop: 2 }]}>🔥 {bestStreak}-day streak</Text>
                  ) : null}
                </View>
                <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
              </Card>
            )}
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title3, { color: colors.label }]}>Wishlist & Ideas</Text>
            <Pressable onPress={() => router.push('/life/wishlist')}>
              <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
            </Pressable>
          </View>
          {activeIdeas.length === 0 ? (
            <Card>
              <EmptyState
                icon="lightbulb.fill"
                title="No ideas yet"
                message="Capture things you want, gift ideas, or plans for later."
              />
            </Card>
          ) : (
            <Card padded={false}>
              {activeIdeas.slice(0, 5).map((item, i, arr) => (
                <WishlistRow key={item.id} item={item} isLast={i === arr.length - 1} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
