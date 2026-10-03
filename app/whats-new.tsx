import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';

// A tour of where things live — Anchor has grown a lot.
const SECTIONS: { title: string; emoji: string; items: string[] }[] = [
  {
    title: 'Money',
    emoji: '💰',
    items: [
      'Bank SMS: HSBC debits read automatically, with instant alerts, a review inbox and a balance check',
      'Safe-to-spend today, budget pace markers and suggested budgets',
      'Bills calendar, subscription detector and "left after fixed costs"',
      'Round-ups into savings goals, debt payoff planner',
      'Year in review, analytics insights, top places and daily spending heatmap',
      '#tags in notes, receipts gallery, shopping list, instalment calculator and currency converter',
      'Zakat with gold-price nisab, hawl reminder and a Sadaqah tracker',
      'Tap the eye on the Money card to hide balances',
    ],
  },
  {
    title: 'Tasks',
    emoji: '✅',
    items: [
      'Quick add like "Call mom tomorrow !high #family"',
      'Plan my day, top task 🐸, priority matrix, Kanban board and routines',
      'Focus timer with breaks, focus stats and completion streaks',
      'Meeting notes: lines starting with "- " become tasks in one tap',
      'Stale backlog clean-up and sharing today\'s plan',
    ],
  },
  {
    title: 'Life',
    emoji: '🌙',
    items: [
      'Prayer times, Qibla, adhan alerts, prayer stats and qada counter',
      'Adhkar, tasbih (incl. after-salah sequence), Quran goal, streak and juz map',
      'Hijri calendar, fasting with Ramadan grid, Sunnah and Mon/Thu fast reminders, Islamic occasions',
      'Journal with gratitude, "On this day" and a gratitude wall',
      'Habits with reminders and best streaks; Health (water, sleep, weight), medications',
      'Reading list, countdowns, notes, occasions and wishlist',
    ],
  },
  {
    title: 'Everywhere',
    emoji: '✨',
    items: [
      'Search (top of Home) covers money, tasks, notes, books and more',
      'Customize Home at the bottom of the Home screen; pull down to refresh',
      'Settings → Upcoming reminders lists every scheduled notification',
      'Morning briefing, evening check-in, water and bedtime reminders',
      'Biometric lock with a timeout; everything syncs to your account',
    ],
  },
];

export default function WhatsNewScreen() {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="What's in Anchor" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {SECTIONS.map((s) => (
          <Card key={s.title} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.xs }]}>
              {s.emoji} {s.title}
            </Text>
            {s.items.map((item, i) => (
              <Text key={i} style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 4 }]}>
                • {item}
              </Text>
            ))}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
