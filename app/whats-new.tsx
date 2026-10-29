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
      'Spots any card you use, from any bank — new banks are added automatically, and new cards show on Home to add, link or ignore',
      'Months can start the day your salary arrives (found in your income or salary SMS), with a payday notification',
      'Your month can start on any day (e.g. payday) — Settings or Money → Plan; budgets, plan, limits and totals follow it',
      'Budgets your way: daily/weekly/monthly/yearly or dates, several categories or all, chosen cards, note keywords, rollover, warning %, colours, pause',
      'Bank SMS: HSBC debits read automatically, with instant alerts, a review inbox and a balance check',
      'Online charges like Uber, Careem and Netflix are now read; Bank SMS shows skipped messages and lets you test any text',
      'Money → Insights: spending calendar, health score, rides, unusual charges, price changes, personal inflation and more',
      'Follow-ups (check later, claim back, refund due), challenges, weekly limit and new calculators in Tools',
      'Live exchange rates, SMS charges matched to your bills, split a transaction, merchant pages and sums in the amount field',
      'Credit vs debit: SMS charges are tagged 💳 credit or 🏦 debit and land in the right account; card payments become transfers',
      'Tap an account for its statement — credit cards by billing cycle with due date, others by month; share as CSV',
      'Credit limit & utilisation, card due reminders, "Paid with" chart, instalment plans, month-end projection',
      'Safe-to-spend today, budget pace markers and suggested budgets',
      'Bills calendar, subscription detector and "left after fixed costs"',
      'Round-ups into savings goals, debt payoff planner',
      'Year in review, analytics insights, top places and daily spending heatmap',
      '#tags in notes, receipts gallery, shopping list, instalment calculator and currency converter',
      'Zakat with gold-price nisab, hawl reminder and a Sadaqah tracker',
      'Tap the eye on the Money card to hide balances',
      'Merchant rules rename bank merchants and remember their category; cash counter in Tools',
      'Duplicate finder and "needs a category" fixer in All Transactions; pay bills from Home',
      'Date chips, save & add another, make a transaction a monthly bill, exclude accounts from net worth, VAT and salary calculators, Zakat "mark as paid"',
      'Money → Cards: every card from every bank in your SMS, its spending and purchases; Bank SMS → "Find my other banks & cards"',
      'Money → Plan: how much to save monthly and spend daily/weekly/monthly, with limit alerts; Money → Limits: every card\'s limit, minimum payment and interest',
      'Swipe transactions to repeat, flag or delete; pay a card\'s minimum in one tap; "This month at a glance", a 7-day chart and big-expense alerts',
      'Search by amount (">500", "100-300"), CSV export, 6-month in/out per account, card payoff, 50/30/20 and cost-per-use calculators',
    ],
  },
  {
    title: 'Tasks',
    emoji: '✅',
    items: [
      'Quick add understands "~30m", "@Ahmed", "next monday", "every friday", "this weekend", "tonight" and "25/12"',
      'Tomorrow and Upcoming lists, quick filters, quick wins, Later swipe, focus on a task, pick 3 from the backlog and a "done today" celebration',
      'Quick add like "Call mom tomorrow !high #family"',
      'Plan my day, top task 🐸, priority matrix, Kanban board and routines',
      'Focus timer with breaks, focus stats and completion streaks',
      'Meeting notes: lines starting with "- " become tasks in one tap',
      'Stale backlog clean-up and sharing today\'s plan',
      'Weekly goals, plan tomorrow, swipe a task to snooze it, end-of-day wrap-up',
      'Time estimates with today\'s load, project deadlines and archived projects',
      'Task deadlines, a Waiting tab, task insights, meeting length, copy a meeting to next week and a daily focus goal',
      'Month calendar in Agenda, paste a list to add many tasks, deadline-day reminders',
      'Long-press a task for a quick menu, sort chips, quick add "at 5pm" / "every week" / "by friday", auto-start routines each morning',
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
      'Quranic duas, Friday checklist, prayer-time fine-tuning in Settings, medication taken log',
      'Hifz tracker (Juz \'Amma), edit the last 7 days of prayers, weekly habit grid, journal prompts, Zakat al-Fitr',
      '99 Names, blessed seasons checklists, hifz revision, dhikr goal and Life → Insights',
      'Vitals (blood pressure, sugar, heart rate), Tahajjud reminder, dhikr phrases, journal search, qada plan',
      'Archive habits, book ratings, checklist notes, Hijri date converter, take-all medications, sleep goal, weekly mood strip, share Life insights',
    ],
  },
  {
    title: 'Everywhere',
    emoji: '✨',
    items: [
      'Much faster and smoother: less redrawing, frozen background tabs, lighter lists and animations, work deferred until screens settle',
      'Search finds accounts, cards, budgets, habits, goals, any screen and any setting; quick add understands more ("5pm", "in 2 hours", "dec 25", بكرة)',
      'Tidier everywhere: Settings in five sections with search, Money with a grouped menu, Home with a swipeable daily card, Tasks views under one "More" menu',
      'Cards & accounts on Home: choose which cards and accounts appear on the main screen, reorder them, or add a new one from the + tile',
      'Home-screen widgets: a Smart Stack that shows what matters right now with a one-tap button, Spending, Habits & Water, and smarter Today, Prayers and Net worth widgets — Settings → Home-screen widgets',
      'Apple-style design: floating glass tab bar, Home widgets, Wallet card stack, Reminders-style smart lists, Shortcuts-style Life tiles and Dynamic Island confirmations',
      'The + beside the tab bar adds anything from anywhere; swipe tasks right to finish; hold rows and cards for quick menus; Jump back in on Home',
      'Search (top of Home) covers money, tasks, notes, books and more',
      'Customize Home at the bottom of the Home screen; pull down to refresh',
      'Settings → Upcoming reminders lists every scheduled notification',
      'Morning briefing, evening check-in, water and bedtime reminders',
      'Everything syncs to your account',
      'Larger text (Settings → Appearance), achievements and a daily recap (tap the rings on Home)',
      'Mood check-in and Ramadan/Eid countdown on Home; 24-hour clock, whole-number amounts, nightly spending digest',
      'Insight of the day, search by amount, monthly report and a backup reminder in Settings',
      'Accent colour, your name on Home, choose your quick actions, quiet hours, hadith of the day',
      'Vibration switch, soft dark mode, start tab, Asr madhab, per-prayer adhan and get-ready reminders, lock now, test notification, search filters',
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
