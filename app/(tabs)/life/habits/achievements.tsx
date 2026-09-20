import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { Card } from '../../../../src/ui/Card';
import { ProgressBar } from '../../../../src/ui/ProgressBar';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { computeBadges } from '../../../../src/domain/habits/achievements';

export default function AchievementsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { habits, checkins } = useHabitsStore();
  const badges = useMemo(() => computeBadges(habits, checkins), [habits, checkins]);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Achievements" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          {earnedCount} of {badges.length} earned
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs }}>
          {badges.map((badge) => (
            <View key={badge.id} style={{ width: '50%', paddingHorizontal: spacing.xs, marginBottom: spacing.sm }}>
              <Card style={{ alignItems: 'center', opacity: badge.earned ? 1 : 0.6 }}>
                <Text style={{ fontSize: 32 }}>{badge.icon}</Text>
                <Text style={[typography.subhead, { color: colors.label, marginTop: spacing.xs, textAlign: 'center', fontWeight: '600' }]}>
                  {badge.label}
                </Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel, textAlign: 'center', marginTop: 2 }]}>
                  {badge.description}
                </Text>
                {!badge.earned ? (
                  <View style={{ width: '100%', marginTop: spacing.sm }}>
                    <ProgressBar progress={badge.progress} height={5} color={colors.gray3} />
                  </View>
                ) : null}
              </Card>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
