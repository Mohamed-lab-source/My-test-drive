import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { useFinanceStore } from '../src/store/financeStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { Card } from '../src/ui/Card';
import { IconCircle } from '../src/ui/IconCircle';
import { ProgressBar } from '../src/ui/ProgressBar';
import { formatMoney } from '../src/utils/money';
import { getWeeklyReview, type WeeklyReview } from '../src/db/review';
import type { JournalMood } from '../src/db/types';

const MOOD_EMOJI: Record<JournalMood, string> = { great: '😄', good: '🙂', okay: '😐', low: '😕', rough: '😣' };

function Stat({ icon, color, label, value, detail }: { icon: string; color: string; label: string; value: string; detail?: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}>
      <IconCircle name={icon} color={color} size={36} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{label}</Text>
        {detail ? <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>{detail}</Text> : null}
      </View>
      <Text style={[typography.headline, { color: colors.label }]}>{value}</Text>
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const fxRates = useFinanceStore((s) => s.fxRates);
  const [review, setReview] = useState<WeeklyReview | null>(null);

  useEffect(() => {
    getWeeklyReview(currency, fxRates).then(setReview);
  }, [currency, fxRates]);

  if (!review) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Weekly Review" />
      </View>
    );
  }

  const spendChange = review.spentPrevWeek > 0 ? (review.spent - review.spentPrevWeek) / review.spentPrevWeek : null;
  const prayerRate = review.prayersDone / review.prayersPossible;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Weekly Review" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>Your last 7 days</Text>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Faith</Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <Stat icon="moon.stars.fill" color={colors.green} label="Prayers" value={`${review.prayersDone}/${review.prayersPossible}`} />
          <View style={{ marginBottom: spacing.xs }}>
            <ProgressBar progress={prayerRate} color={colors.green} />
          </View>
          <Stat icon="hands.sparkles.fill" color={colors.mint} label="Dhikr" value={String(review.dhikr)} />
          <Stat icon="book.fill" color={colors.green} label="Quran pages" value={String(review.quranPages)} />
        </Card>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Productivity</Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <Stat icon="checkmark.circle.fill" color={colors.blue} label="Tasks completed" value={String(review.tasksCompleted)} />
          <Stat icon="clock.fill" color={colors.indigo} label="Focus time" value={`${review.focusMinutes} min`} />
          {review.habitRate !== null ? (
            <Stat icon="flame.fill" color={colors.orange} label="Habit consistency" value={`${Math.round(review.habitRate * 100)}%`} />
          ) : null}
        </Card>

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Money</Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <Stat
            icon="cart.fill"
            color={colors.red}
            label="Spent"
            value={formatMoney(review.spent, currency)}
            detail={
              spendChange === null
                ? undefined
                : `${spendChange > 0 ? '▲' : '▼'} ${Math.abs(Math.round(spendChange * 100))}% vs. the week before`
            }
          />
          <Stat icon="banknote.fill" color={colors.green} label="Income" value={formatMoney(review.income, currency)} />
        </Card>

        {review.moods.length > 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Mood</Text>
            <Card>
              <Text style={{ fontSize: 28, letterSpacing: 4 }}>{review.moods.map((m) => MOOD_EMOJI[m]).join('')}</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
                {review.moods.length} journal check-in{review.moods.length === 1 ? '' : 's'}, oldest first
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
