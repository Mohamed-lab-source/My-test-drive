import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';
import { getDb } from '../src/db/client';
import * as lifeRepo from '../src/db/repositories/life';
import { QURAN_PAGES } from '../src/db/types';

interface Badge {
  emoji: string;
  title: string;
  detail: string;
  earned: boolean;
  progress?: string;
}

async function count(sql: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(sql);
  return row?.n ?? 0;
}

// Milestones worked out from what's already in the database.
async function loadBadges(): Promise<Badge[]> {
  const [txs, tasksDone, journal, focusMin, dhikr, khatm, currentPages, goalsDone, debtsAll, debtsOpen, prayerStreak, fasts, books] = await Promise.all([
    count('SELECT COUNT(*) AS n FROM transactions'),
    count("SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'"),
    count('SELECT COUNT(*) AS n FROM journal_entries'),
    count('SELECT COALESCE(SUM(minutes), 0) AS n FROM focus_sessions'),
    count('SELECT COALESCE(SUM(count), 0) AS n FROM dhikr_logs'),
    lifeRepo.getCurrentKhatm(),
    count('SELECT COALESCE(SUM(pages), 0) AS n FROM quran_logs WHERE khatm = (SELECT MAX(khatm) FROM quran_logs)'),
    count('SELECT COUNT(*) AS n FROM savings_goals WHERE is_completed = 1'),
    count('SELECT COUNT(*) AS n FROM debts'),
    count("SELECT COUNT(*) AS n FROM debts WHERE status != 'paid'"),
    lifeRepo.computePrayerStreak(),
    count('SELECT COUNT(*) AS n FROM fasting_logs'),
    count("SELECT COUNT(*) AS n FROM books WHERE status = 'finished'"),
  ]);
  const b = (emoji: string, title: string, detail: string, value: number, target: number): Badge => ({
    emoji,
    title,
    detail,
    earned: value >= target,
    progress: value >= target ? undefined : `${Math.min(value, target)} / ${target}`,
  });
  return [
    b('🌱', 'First step', 'Log your first transaction', txs, 1),
    b('📒', 'Bookkeeper', 'Log 100 transactions', txs, 100),
    b('🕌', 'Steadfast week', 'All 5 prayers, 7 days in a row', prayerStreak, 7),
    b('🌙', 'Steadfast month', 'All 5 prayers, 30 days in a row', prayerStreak, 30),
    // Earlier khatms are all finished; the current one counts once it reaches the last page.
    b('📖', 'Khatm', 'Complete a full reading of the Quran', khatm - 1 + (currentPages >= QURAN_PAGES ? 1 : 0), 1),
    b('📿', 'Remembrance', '1,000 dhikr counted', dhikr, 1000),
    b('✅', 'Getting things done', 'Complete 10 tasks', tasksDone, 10),
    b('🏆', 'Centurion', 'Complete 100 tasks', tasksDone, 100),
    b('⏱', 'Deep worker', '10 hours of focus sessions', Math.floor(focusMin / 60), 10),
    b('📝', 'Reflective', '7 journal entries', journal, 7),
    b('🎯', 'Goal getter', 'Reach a savings goal', goalsDone, 1),
    b('🕊', 'Debt-free', 'Pay off every debt you tracked', debtsAll > 0 && debtsOpen === 0 ? 1 : 0, 1),
    b('🍽', 'Faster', 'Log 10 fasts', fasts, 10),
    b('📚', 'Reader', 'Finish 5 books', books, 5),
  ];
}

export default function AchievementsScreen() {
  const { colors, typography, spacing } = useTheme();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    loadBadges().then(setBadges);
  }, []);

  const earned = badges.filter((b) => b.earned).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Achievements" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          {earned} of {badges.length} earned
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {badges.map((b) => (
            <View key={b.title} style={{ width: '50%', padding: 4 }}>
              <Card style={{ alignItems: 'center', minHeight: 140, opacity: b.earned ? 1 : 0.55 }}>
                <Text style={{ fontSize: 36 }}>{b.earned ? b.emoji : '🔒'}</Text>
                <Text style={[typography.headline, { color: colors.label, marginTop: 4, textAlign: 'center' }]}>{b.title}</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, textAlign: 'center', marginTop: 2 }]}>{b.detail}</Text>
                {b.progress ? (
                  <Text style={[typography.caption1, { color: colors.blue, marginTop: 4, fontWeight: '600' }]}>{b.progress}</Text>
                ) : null}
              </Card>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
