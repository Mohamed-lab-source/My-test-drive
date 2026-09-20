import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useHabitsStore } from '../../store/habitsStore';
import { quoteOfTheDay } from '../../domain/habits/quotes';
import { challengeOfTheDay } from '../../domain/habits/challenges';
import { computeCorrelationInsight } from '../../domain/habits/insights';

export function QuoteOfTheDayCard() {
  const { colors, typography, spacing } = useTheme();
  const quote = useMemo(() => quoteOfTheDay(), []);
  return (
    <Card style={{ backgroundColor: colors.indigo + '14' }}>
      <Text style={[typography.subhead, { color: colors.label, fontStyle: 'italic' }]}>"{quote.text}"</Text>
      <Text style={[typography.caption1, { color: colors.indigo, marginTop: spacing.xs, fontWeight: '600' }]}>
        — {quote.attribution}
      </Text>
    </Card>
  );
}

export function ChallengeOfTheDayCard() {
  const { colors, typography, spacing } = useTheme();
  const challenge = useMemo(() => challengeOfTheDay(), []);
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{challenge.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, fontWeight: '700', textTransform: 'uppercase' }]}>
          Today's challenge
        </Text>
        <Text style={[typography.subhead, { color: colors.label, marginTop: 2 }]}>{challenge.text}</Text>
      </View>
    </Card>
  );
}

export function CorrelationInsightCard() {
  const { colors, typography, spacing } = useTheme();
  const { habits, checkins } = useHabitsStore();
  const insight = useMemo(() => computeCorrelationInsight(habits, checkins), [habits, checkins]);

  if (!insight) return null;

  return (
    <Card style={{ backgroundColor: colors.mint + '14' }}>
      <Text style={[typography.caption1, { color: colors.mint, fontWeight: '700', textTransform: 'uppercase' }]}>
        Pattern spotted
      </Text>
      <Text style={[typography.subhead, { color: colors.label, marginTop: spacing.xs }]}>
        {insight.a.icon} {insight.a.name} → {insight.b.icon} {insight.b.name}
      </Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
        You complete {insight.b.name} {Math.round(insight.withRate * 100)}% of the time after {insight.a.name}, vs{' '}
        {Math.round(insight.withoutRate * 100)}% otherwise. Try stacking them.
      </Text>
    </Card>
  );
}
