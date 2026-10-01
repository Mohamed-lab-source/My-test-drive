# Anchor

A personal finance and life-organization app, built with Expo (React Native) and an Apple-inspired design system.

Your Money/Tasks/Life data lives on-device in SQLite and is the source of truth the app reads from — opening the app requires a real account (see **Account** below), and that account's data also syncs to Firestore in the background.

## Account

Anchor opens to a sign-in flow before showing any of your data:

- **Welcome** — Sign In or Create Account
- **Create Account** — a short, animated wizard: name → email → password → done
- **Sign In** — email + password

This is designed against a swappable `AuthBackend` interface (`src/auth/backend.ts`), currently backed by `src/auth/firebaseAuthBackend.ts` (Firebase Authentication, email/password).

## Cloud sync

Once signed in, every write to the local SQLite tables (`src/db/helpers.ts`'s `insertRow`/`updateRow`/`deleteRow`) is mirrored in the background to Firestore under `users/{uid}/{table}/{id}` (`src/sync/firestoreSync.ts`). Local SQLite stays the source of truth the UI reads from — Firestore's native offline persistence queues writes made while offline and flushes them automatically on reconnect. On sign-in, `pullAllFromCloud()` fetches every synced table from Firestore and merges it into local SQLite, so a returning account picks its data back up on a new device.

Firestore access is locked down by `firestore.rules` at the repo root: a user may only read/write documents under their own `users/{uid}` subtree. Deploy it with `firebase deploy --only firestore:rules` (or paste it into the Firebase console's Rules tab) once the project is set up.

## Features

**Money**
- Accounts (cash, bank, savings, credit) with running balances, converted to one net worth via manual FX rates for multi-currency accounts
- Income / expense / transfer transactions with categories, an optional receipt photo, and a global search
- Debts — track what you owe and what's owed to you, with partial payments and a pace-based payoff date estimate
- Subscriptions & recurring expenses/income, with next-due tracking, pause/resume, and skip-this-cycle
- Savings goals with progress rings, contributions, and a pace-based completion estimate
- Monthly budgets per category with progress bars and overspend flags
- Analytics — income vs. expense trend and category breakdown for the current month
- CSV export of transactions (alongside the JSON backup)
- Tap any transaction to edit it (balances re-adjust); swipe to repeat it today; filter the full list by type, account and category
- Accounts screen — add, rename, change type/currency, set a balance to match your bank, archive
- Zakat calculator (2.5% above a user-entered nisab, with receivables/debts toggles)
- Month-in-review: spend vs. last month, top category, biggest expense, net
- Split a bill: "Split with" names on a new expense creates an "owed to me" debt per person for their share
- Auto-post recurring items (salary, rent) when they come due, catching up missed cycles on launch
- Budget alerts: a notification when a category crosses 80% and 100% of its monthly limit
- Daily net-worth snapshots with a history chart, and a 30-day cash-flow forecast from recurring items
- Default account for new transactions
- Custom categories
- Savings goal deadlines with a "save X/month" plan; debt due dates with a reminder the day before
- Subscriptions total normalised across daily/weekly/monthly/yearly items, per month and per year
- Tap a category in Analytics for its 6-month spending trend
- Search the full transaction history by note
- More currencies: KWD, QAR, BHD, OMR, JOD, INR, PKR, MYR, IDR
- Bill calendar — every recurring due date in a month grid, with totals going out and coming in
- Frequent transactions: one-tap chips in the add sheet for things you log repeatedly
- Account detail screen with its transactions (including incoming transfers) and this month's in/out
- Safe to spend today (budget left ÷ days left) and no-spend days this month
- Savings rate and emergency runway in Analytics; share a month summary as text
- **Bank SMS (Android)** — reads debit alerts from chosen senders (default: HSBC) on launch and whenever the app returns to the foreground; parses amount, currency, merchant and card digits (English and Arabic), guesses a category, and queues each debit in a review inbox. Nothing is added until you confirm; ATM withdrawals become a transfer into Cash. Messages are filtered by sender in native code, stay on the device, and are never synced or backed up. Native code lives in `modules/anchor-sms`.
- Shopping list with estimated prices; tick an item off and log it as an expense in one tap
- Suggested budgets from your 3-month average spend
- Money tools: instalment calculator and a currency converter using your saved rates
- Gold price per gram → nisab (85 g) on the Zakat screen, plus a Sadaqah tracker with a monthly goal
- Spending insights: categories running above or below your usual pace this month

**Tasks**
- Today / Backlog / All views, with unfinished "Today" tasks rolling into Backlog automatically
- Priorities, projects (with a dedicated Projects screen and manual reordering), notes, subtasks/checklists
- Recurring tasks that regenerate their next occurrence on completion
- Meetings with date/time/location and reminder notifications
- Agenda view merging tasks and meetings by day for the next two weeks
- Reschedule from the task sheet (Today / Tomorrow / Next week / Backlog)
- Focus timer (15/25/50 min) with an end-of-session notification; sessions feed the weekly review
- Done tab with an undoable "Clear completed"
- Natural-language quick add: `Call mom tomorrow !high #family` (today/tomorrow/weekday/next week/someday, !high/!low, #project)
- Task reminders (in 1 hour / this evening / tomorrow 9 AM)
- Tap a meeting to edit it, with a configurable reminder lead time and notes
- Filter tasks by project; subtask progress (e.g. 2/5) on each task row
- Plan my day: pick backlog tasks for today
- Duplicate a task along with its subtasks
- Focus stats: today, last 7 days chart, streak and most-focused tasks
- Open a meeting's location in Maps, or its link if it's a video call
- Kanban board (Backlog → To do → In progress → Done)
- Routines: saved task lists added to today in one tap
- Create a follow-up task from a meeting
- Tasks completed per day (last 14 days) on the Focus screen

**Life**
- Daily 5-prayer tracker with streaks
- Wishlist / ideas board with priority and price, with one-tap "save up for this" to spin up a savings goal
- General-purpose habit streak tracker for any custom daily habit
- Daily journal / mood check-in
- Prayer history heatmap (last 5 weeks) and per-habit history heatmaps
- Tasbih counter (33/99/100 rounds, daily total)
- Quran khatm tracker (pages read, pace-based finish date, multiple khatms)
- Prayer times for 30+ cities (via `adhan`, each with its local calculation method), next-prayer countdown, and optional adhan notifications
- Hijri date on Home (Umm al-Qura via Intl when available, arithmetic fallback, ±2 day adjustment)
- Fasting tracker (Ramadan / voluntary / make-up) with a 5-week heatmap and 12-month totals
- Occasions — birthdays and anniversaries sorted by how soon they are, with a yearly reminder on the day
- Prayer times screen — today's times with sunrise and the last third of the night, a 7-day timetable, and the Qibla bearing
- Jumu'ah reminder on Fridays, an hour before Dhuhr
- 30-day mood trend in the journal, plus three gratitude lines per day
- Morning and evening adhkar checklists
- Hijri calendar with key Islamic days and what's coming up
- Qada counter for make-up prayers
- Quran position: next page, juz, and pages left in the juz
- Daily habit reminders at a chosen time
- Sunnah fast reminders the evening before the white days, Arafah and Ashura
- Health: water (daily goal, optional reminders every 2 hours), sleep and weight logs with charts
- Sunnah prayers tracker (rawatib, Duha, Tahajjud, Witr)
- Reading list with page progress
- Countdowns to events, the nearest one shown on Home
- Quick notes with pinning and search

**Home**
- Quick actions: log an expense, add a task, open Tasbih or Quran
- Getting started checklist for new accounts (dismissible)
- Suhoor / iftar countdown during Ramadan
- Verse of the day
- Optional 8 AM morning briefing and 9 PM journal check-in notifications
- Customize Home: hide any card you don't use

**Weekly review**
- One screen for the last 7 days: prayers, dhikr, Quran pages, tasks done, focus minutes, habit consistency, spending vs. the prior week, and mood

**Home-screen widgets (Android)**
- Prayers — today's 5 prayers with streak and the next prayer time, tap a prayer to mark it done right from the widget
- Today — your tasks scheduled for today; tap the circle to mark a task done, tap + to add one
- Net worth — current net worth and next upcoming bill; tap + to log an expense, tap Pay to post the bill

**Settings**
- Light/Dark/System appearance
- Currency selection, manual exchange rates for foreign-currency accounts
- Local notifications for meeting and bill-due reminders
- Biometric (Face ID / fingerprint) app lock
- JSON export/import backup, CSV export, full reset

## Tech stack

- Expo SDK 57 (React Native 0.86, React 19), TypeScript, Expo Router
- SQLite via `expo-sqlite`, hand-rolled repositories (no ORM)
- Firebase Authentication + Firestore via `@react-native-firebase/*` (native SDK, offline-first)
- `expo-notifications` for local reminders, `expo-local-authentication` for biometric app lock, `expo-image-picker` for receipt photos
- Zustand for app state
- `react-native-reanimated` + `react-native-gesture-handler` for animations (sheets, swipe actions, spring transitions)
- Custom iOS-styled design system (colors, typography, spacing) in `src/theme`

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a simulator, or `w` for web.

## Project structure

```
app/(auth)/           sign-in / create-account flow (gates the tabs below)
app/(tabs)/           expo-router screens (tabs: Home, Money, Tasks, Life, Settings)
src/auth/             AuthProvider + swappable AuthBackend (Firebase Authentication)
src/db/               SQLite schema, client, repositories, backup/restore
src/sync/             Firestore cloud sync layer (users/{uid}/{table}/{id})
src/notifications/    local notification scheduling (meetings, bills, debts, tasks, prayers, occasions)
src/store/            zustand stores (finance, productivity, life, habits, settings)
src/theme/            colors, typography, spacing, ThemeProvider
src/ui/               reusable design-system components
src/features/         feature-specific components (add sheets, rows) grouped by domain
src/widgets/          Android home-screen widgets (Prayers, Today, Net worth)
src/sms/              bank SMS parsing, scanning and review store
modules/anchor-sms/   local Expo native module that reads the SMS inbox (Android)
```
