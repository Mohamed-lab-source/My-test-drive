import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';

// A tour of where things live — Anchor has grown a lot.
const SECTIONS: { title: string; emoji: string; items: string[] }[] = [
  {
    title: 'Debts & categories',
    emoji: '🎯',
    items: [
      'Money → Debt-free plan: every card balance and loan in one plan — a monthly amount, highest-interest or smallest-first order, what to pay on each this month (with Pay buttons), when each is cleared and your debt-free date',
      'See how much interest the plan saves compared with paying only the minimums, and how much you\'ve paid off since you started; add it to the payday checklist; set interest and instalments for loans',
      'For you reminds you on payday what to pay toward debts and which debt is the focus',
      'Categories (Money menu or Settings): separate Spending and Income lists with this month\'s totals, edit name/icon/colour, 58 icons, archive and restore, delete safely by moving transactions to another category, and one-tap suggestions like Rent, Kids & school, Gam\'eya, Freelance, Bonus',
      'Create a new category right while adding a transaction — tap "New" in the category list',
    ],
  },
  {
    title: 'Wealth',
    emoji: '🌱',
    items: [
      'Money → Wealth: your next money step (backup, cards, saving, full backup, debts, investing), with how you stand on each',
      'Save: how much you keep each month (6-month chart), a savings goal as a % of income, where you could save (subscriptions, delivery, rides, coffee, top categories) and what it grows into, with inflation',
      'Backup money: how many months it would last, a 3–12 month target sized on all or essential spending, which accounts (and liquid investments) hold it, how much a month fills it, one tap to add it to the payday checklist',
      'Invest: a four-question investing style with a mix to aim for, an "avoid interest" mode that points to sukuk and Sharia-screened stocks, everything you hold (gold by grams and karat, certificates, sukuk, funds, stocks, dollars, property) with gains, your real mix vs the target, and where this month\'s money should go',
      'For you now nudges you when backup money is low, to invest on payday, and when spending passes income',
    ],
  },
  {
    title: 'Made for you',
    emoji: '✨',
    items: [
      'For you (Home, Settings, Life): what needs you right now, picked from your own money, cards, prayers, habits, tasks and occasions — long-press to dismiss for today or turn a kind off',
      'Salary arrived → payday checklist; salary late; days to next month with money per day; card payment due, card near its limit, statement closing and the best card to use today',
      'Rides (Uber, Careem, inDrive…) and food delivery (Talabat, elmenus, Breadfast…) up on last month, coffee count, subscriptions renewing, big or double charges, late-night spending, a weekly recap and no-spend days',
      'Over today\'s limit, bank SMS to review, uncategorized spending, budgets running out, savings goals behind, your Umrah fund and money people owe you',
      'Next prayer soon, prayers not marked, Surat Al-Kahf on Friday, Monday/Thursday and White Day fasts, Quran goal, zakat year, Eid & Ramadan coming',
      'Water, habits left, streaks at risk, journal, overdue tasks, meetings soon, birthdays with what they gave you last time, Thursday weekend planning and a morning summary',
      "Gam'eya (جمعية): every circle, whose turn it is, your turn and payout, pay your share (and log it), the pot as income, late shares and names per turn",
      'Payday checklist: pay the cards (with Pay buttons), save %, sadaqah %, gam\'eya, family and bills — amounts from your salary, ticks reset each payday',
      'Gifts & nokta (النقطة): what you gave and got at weddings, births and Eids, who to give back to and how much, upcoming occasions, year totals, log as an expense',
      'Eidiya (العيدية): envelopes by group, the new notes to get from the bank (and share the list), tick as you give, New Eid keeps everyone',
      'Calculators for Egypt: restaurant bill with 12% service + 14% VAT, gold by karat, bank certificates, the interest hidden in instalments, Ramadan budget, fuel for a trip and a raise',
      'Quick add by prayer time: "call mom after Asr", "15m before Maghrib", "after Friday prayer", "بعد العصر" — using your city\'s times',
      'More Egyptian shops recognised for bank SMS categories: Kazyon, Mo\'men, Go Bus, Fawry, WATCH IT, B.TECH, Al Borg and more',
    ],
  },
  {
    title: 'Money',
    emoji: '💰',
    items: [
      'Back goes where you came from: open a card from Home and back (button, Android back or swipe) returns to Home, and Money still opens on Money',
      'Fixed: every card gets its own account — new cards no longer pile onto the first card detected, merged cards are split back apart with their charges, and Money → Cards has “Fix cards on the wrong account”',
      'Each build now has its own version number (bottom of Settings), so the APK always installs as an update',
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
      'Liquid glass home-screen widgets: see-through with a glass rim and sheen over your wallpaper — or Solid, on the Widgets page',
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
