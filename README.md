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
- Bank SMS extras: an instant "new card payment" notification from a native SMS receiver (works while Anchor is closed), auto-add for merchants you've confirmed before, and optional reading of money in (salary, transfers, refunds) as income
- Subscription detector: spots monthly repeating charges and offers to track them
- Top places this month, a daily spending heatmap, and a net worth goal with progress
- #tags in transaction notes with a tag filter; receipts gallery; hide-balances privacy toggle
- Budget pace markers with a daily allowance per budget; low-balance alerts
- Debt payoff planner (smallest-first or earliest-due-first), round-up savings into goals
- Year in review; "left after fixed costs" from recurring income vs. bills
- Bank SMS balance check against the bank's reported available balance, with one-tap reconcile
- Merchant rules (rename bank merchants, remember category), bank sender presets, duplicate finder, bulk categorize
- Pay bills from Home, people summary for debts, last-month recap card, savings milestones, cash counter
- Shopping list with estimated prices; tick an item off and log it as an expense in one tap
- Suggested budgets from your 3-month average spend
- Money tools: instalment calculator and a currency converter using your saved rates
- Gold price per gram → nisab (85 g) on the Zakat screen, plus a Sadaqah tracker with a monthly goal
- Spending insights: categories running above or below your usual pace this month
- **Credit vs debit** — each bank SMS is tagged 💳 credit card or 🏦 debit/account (from wording like "credit card", "available limit", "debit card", "account"), and the card digits are remembered so later charges go to the right account automatically. Credit card charges post to your credit card account; card payments ("payment received") become a transfer from your bank to the card. Create the card account straight from the SMS inbox
- Credit card accounts: amount owed, credit limit with a utilisation bar, statement day and payment due day
- Account statements: credit cards by billing cycle (statement balance and due date), other accounts by month, with opening/closing balance, money in/out and a running balance on every line; share as text or CSV
- "Credit vs debit" card on Money home and a "Paid with" chart in Analytics (credit card / debit / cash per month)
- Pay in instalments (3–24 months) from the add-expense sheet; the remaining instalments post themselves and the plan ends on its own
- Month-end spending projection, spending by weekday, reorder accounts, foreign-currency SMS charges converted with your saved rate, undo after adding from the SMS inbox
- **Online card charges (Uber, Careem, Netflix…)** — bank SMS worded as "E-Commerce transaction", "online transaction", "authorization", "Trx" or the Arabic "عملية … عبر الإنترنت" are now read, by both the inbox scan and the instant alert. 45+ well-known merchants get clean names (e.g. "UBER *TRIP HELP.UBER.COM" → Uber); Uber Eats goes to Dining. Promo, cancelled and rejected messages are ignored
- Messages Anchor skipped: bank texts from the last 30 days that weren't imported, with the reason, "Add as expense" and "Share text"; a "Test a message" box shows exactly how any SMS is read; rescan the last 90 days
- Insights screen: spending calendar, month story, financial health score, rides, delivery vs groceries, unusual charges, price changes, biggest category changes, time of day, weekdays vs weekend, small purchases, regular places, top merchants, personal inflation, no-spend streaks, payday effect, saving streak, income sources, fixed vs flexible, bank fees, ATM, foreign currency, tags, year to date — shareable
- Follow-ups: flag a transaction to check later, claim back or as a refund due; log the money coming back in one tap
- All Transactions: period filter (week, month, last month, 3 months, year — reads full history), sort by oldest or largest, minimum amount, and totals for what's shown
- Weekly spending limit card (with an alert), challenges (no-spend days goal, 52-week savings), net worth by account type, credit card "still to pay" and minimum payment
- Tools: tip & split, sale price, which-is-cheaper, time to save, savings growth, loan amortisation table
- Live exchange rates: "Update rates online" in Settings fetches today's rates for every currency you hold or spend in
- Bank SMS: a charge matching a due bill (amount within 3%, due within a week) offers "Add & mark bill paid"; "Always ignore" a merchant; a smarter duplicate check (±1 day, shows the matching entry, "Same one — dismiss")
- Split one transaction across categories; merchant pages (totals, visits, average, 12-month chart) from Insights or any expense
- Spending pace card (this month vs. the same days last month), quick + Expense / + Income / Transfer (or Pay card) buttons on every account, and sums in the amount field (120+45.5, with + − × ÷ keys)

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
- Project progress bars, search across all tasks, and a daily "top task" pinned on Tasks and Home
- Priority matrix, stale-backlog clean-up, share today's plan, focus breaks (5/15 min), completion streak
- Meeting notes: "- " lines become tasks in one tap
- Weekly goals, plan tomorrow, swipe-to-snooze, end-of-day wrap-up, time per project, next-meeting chip on Home
- Time estimates on tasks with a "Today's load" bar (tasks + meetings) and an overload warning over 6 hours
- Project deadlines (due in N days / overdue) and archiving projects
- Task deadlines with due/overdue badges, an overdue card ("move all to today"), and tasks due today showing in Today and the morning briefing
- "Waiting on" someone, with its own Waiting tab
- Task insights: done vs added, best weekday and hour, typical time to finish, on-time rate, open tasks by priority, meeting hours this week
- Meeting length, copy a meeting to next week, daily focus goal
- Month calendar in Agenda (tasks, deadlines, meetings), deadlines in the 2-week list, paste several lines to add several tasks, a 9 AM reminder on deadline days
- "Done today" progress on Tasks, meeting length-aware sharing of meeting details

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
- Quran daily pages goal with a streak
- After-salah tasbih sequence (33 / 33 / 33 + tahlil)
- Ramadan 30-day grid and a make-up fasts owed counter
- Medication reminders at chosen times
- Habit completion for the month, bedtime reminder, weight goal
- Prayer stats (which prayer is missed most), Quran juz map, dhikr 7-day chart, habit best streak, water streak
- Journal "On this day" and a gratitude wall
- Reminders for Islamic occasions, Monday/Thursday fasts and your zakat hawl date
- Quranic duas with favorites, Friday checklist, missed-prayer → qada prompt, Quran reminder, prayer-time fine-tuning
- Habit reordering, mood vs. sleep insight, journal export, yearly reading goal, medication taken log
- Hifz tracker for Al-Fatiha and Juz 'Amma (not started → learning → memorised) with a "next up" suggestion
- Edit prayers for the last 7 days from Prayer history; weekly habit grid you can tap to fix missed days
- Journal prompts; Zakat al-Fitr calculator (people × rate) that can log the payment
- 99 Names of Allah with meanings, a name of the day and a "learnt" tracker
- Blessed seasons: last ten nights checklist, first ten days of Dhul Hijjah (fasting days + acts) and the six fasts of Shawwal
- Hifz revision plan (the memorised surahs you revised longest ago), daily dhikr goal in Tasbih
- Life insights: prayers marked on time, mood by weekday, journal streak and gratitude count, strongest/weakest habit, water, sleep week-on-week, BMI, medication adherence, reading pace and finish dates
- Vitals in Health: blood pressure, blood sugar and heart rate with 7-day averages and general guidance ranges
- Tahajjud reminder at the last third of the night, dhikr phrases in Tasbih, journal search and mood filter, make-up (qada) plan with a finish date, "finish your khatm before Ramadan" pages-per-day

**Home**
- Cards & accounts: the cards and accounts you choose, as mini Wallet cards (balance, or owed and available with a limit bar for credit cards, and this month's spending); tap one for its statement, long-press to add an expense, pay the card or remove it; the + tile adds existing ones or a new card or account (new ones show on Home automatically, with a "Show on Home" switch)
- Quick actions: log an expense, add a task, open Tasbih or Quran
- Getting started checklist for new accounts (dismissible)
- Suhoor / iftar countdown during Ramadan
- Verse of the day
- Optional 8 AM morning briefing and 9 PM journal check-in notifications
- Customize Home: hide any card you don't use
- Next-prayer countdown chip under the title
- Global search also covers notes, books, shopping and countdowns
- Today rings on Home (prayers · tasks · water), pull-to-refresh on Home and Money
- Settings → Upcoming reminders (every scheduled notification) and What's in Anchor (feature tour)
- Day recap, achievements, larger text option, and a "Your data" summary
- Insight of the day, Name of Allah of the day and a "spent today" line (each can be hidden in Customize Home)
- Search finds transactions by amount too (type 125.50) and shows each amount in the results
- Hadith of the day and a past gratitude on Home; customisable quick actions (choose any 4 of 12) and a greeting with your name

**Weekly review**
- One screen for the last 7 days: prayers, dhikr, Quran pages, tasks done, focus minutes, habit consistency, spending vs. the prior week, and mood

**Home-screen widgets (Android)**
- Smart Stack — like iOS's: scores everything going on and shows what matters right now, big, with a one-tap button (Join a meeting about to start, mark the prayer whose time it is, Pay a bill due today, what you can still spend today, Done on a task whose reminder is near, tick a habit in the evening, +1 glass when you're behind on water, special Hijri days, and a look at tomorrow late at night); the next few underneath when the widget is taller
- Spending — today's allowance as a ring, what's left this week and this month from your plan, an on-track / watch / over badge and the month-end projection
- Today — overdue and due-today tasks first, then by priority and reminder time, with a progress bar; tap a circle to finish one; a celebration and tomorrow's first tasks when you're done
- Habits & Water — tick habits off (with streaks) and add a glass of water right from the home screen
- Prayers — every prayer time today, the next one ringed, the current one flagged until marked, Hijri date, streak; tap a prayer to mark it
- Net worth — a 30-day trend line, change this month, today's spending against your limit and the next bill with Pay
- All widgets resize, follow light/dark mode, refresh as you use Anchor and whenever you leave it, and a button on one updates the others; Settings → Home-screen widgets previews them with your data and adds them in one tap

**Settings**
- Light/Dark/System appearance
- Currency selection, manual exchange rates for foreign-currency accounts
- Local notifications for meeting and bill-due reminders
- JSON export/import backup, CSV export, full reset
- Card payment due reminders (3 days before and on the due day) and an optional 9:30 PM spending digest
- 24-hour clock and whole-number amounts (Settings → Appearance); recent searches
- Big-spending-day alert, weekend days (Fri–Sat / Sat–Sun) and the day your week starts
- Backup reminder (last export date) and a shareable monthly report: money, tasks, prayers, habits and mood
- Accent colour, quiet hours for spending alerts, monthly recap and weekly review reminders, tasks CSV export; notifications open the right screen when tapped

**Fast and smooth**
- Screens only redraw for the data they show, tabs and screens you're not looking at stay frozen, long transaction lists load 60 rows at a time, the money counters animate cheaply, widget updates are batched until you stop tapping, and start-up/resume housekeeping waits until the screen has settled

**Search everything**
- Search finds accounts and cards (by name or last digits), budgets, habits, savings goals, every screen ("zakat", "payday") and every setting, as well as money, tasks, notes and more; a purchase opens everything spent at that place, and "Jump to" shortcuts show before you type
- Quick add also understands !1/!2/!3 and p1–p3, bare times ("5pm", "17:30"), "in 2 hours", "this evening", "tomorrow morning", "noon", "next month", "end of month", "dec 25" and Arabic بكرة / النهارده
- Budgets: "See spending" opens their transactions; Money's attention row also flags bills due and transactions needing a category; Plan says when a salary looks late; transaction month filters follow your payday

**Organised and concise**
- Settings is a short list — General, Money, Prayer & Hijri, Notifications, Data & backup — each opening its own page, plus a search box that finds any setting
- Money keeps the essentials up top (net worth, plan, last 7 days, a short wallet with "Show all", recent activity), a "needs attention" row only when something does, and one grouped menu: Plan · Accounts & cards · Bills & spending · Reports & tools; the extra analysis cards live in Analytics
- Home puts Today's tasks right after the quick actions, swipes through the verse, Name of Allah, hadith and insight of the day in one card, and drops cards the top tiles already show
- Tasks' extra views (Agenda, Board, Projects, Routines, Focus, Meetings, Matrix, Insights) sit behind one labelled "More" menu; Life moves the prayer record to Prayer times and the wishlist to a tile

**Your month, your budgets**
- Or start each month when your salary actually arrives: paydays are found in your income (Salary category, or "salary"/"payroll"/"راتب" in the note, including salary SMS), the month stays open if the salary is late, a notification says when a new month starts, and "My salary arrived today" starts one by hand
- Choose a fixed day your month starts instead (e.g. the 25th): the spending plan, budgets, limits, "this month" totals, Safe to spend, last month's summary and the widgets all run from it (Settings, or Money → Plan)
- Budgets are fully customisable: any name, icon and colour; daily, weekly, monthly, yearly or between two dates (with one-tap ranges for a trip); one category, several, or all spending; only certain accounts or cards; only notes containing words like "Talabat, Uber"; count bills or not; roll leftovers (or overspending) into the next period; warn at 50/75/80/90% or only when over; notes; pause and resume
- Each budget shows spent of available, a pace marker, what's left per day, the end-of-period projection, last period and any rollover; filter by period, tap to edit with a live preview, hold to duplicate or pause, swipe to pause or delete
- Alerts follow each budget's own period and warning level

**Spending plan & limits**
- Money → Plan works out, from your income (or the average of the last 3 months), bills and savings goals, how much to save each month (the larger of what your goals need and your chosen share of income) and how much you can spend this month, this week and today
- Daily, weekly and monthly limits: the plan suggests them, or set your own; progress rings and bars, an on-track / watch / over status with the month-end projection, and how much less to spend a day to finish on budget
- Alerts as an expense crosses 80% and 100% of a daily, weekly or monthly limit, of an account's own monthly limit, and 30% / 70% / 90% of a card's credit limit (only the most important one is sent); an optional 8:30 AM "you can spend X today" notification
- Money → Limits (Cards & accounts): totals across all credit cards (owed, available, total limit, overall utilisation) and, per card, utilisation, current-cycle spending, due date countdown, minimum payment, monthly interest if carried over and how long the minimum takes to clear it; per account, this month vs the same time last month and how long the balance lasts at the current pace
- Each account and card can have its own monthly limit, interest rate, minimum payment % and card digits (which also match bank SMS charges to it)

**Easier to use**
- A round + beside the tab bar on every screen: it adds whatever the screen is about (a note, a habit, a task…), and holding it (or tapping it where there's nothing to add) opens a menu for an expense, income, transfer, task, note, journal entry, a glass of water or search
- "Jump back in" on Home: the screens you used most recently, one tap away
- Swipe a task right to finish it (with a haptic click when it's armed); swipe left for Tomorrow / Delete; tick tasks off straight from Home with an undo
- iOS-style long-press menus with icons: on tasks, on transactions (edit, duplicate for today, flag, delete with undo) and on Wallet cards (add an expense or income, or transfer from that account)
- Big centred amount when logging money; cross-fade between tabs; confirmations in the Dynamic Island pill

**Design**
- Inspired by Apple's devices: an iOS 26-style floating glass tab bar with a sliding lens, soft colour glows behind each screen's title, Home Screen-style widgets on Home, a Wallet card stack for accounts, Reminders-style smart lists in Tasks, Shortcuts-style gradient tiles in Life, an Apple Account-style card in Settings, and Dynamic Island-style confirmations
- Apple-style look throughout: Inter (the closest open match to San Francisco) on Android with real weights and SF-style tracking, the system font on iOS, and Apple's exact label greys
- Large titles that zoom when you pull down and hand over to a compact title bar as you scroll; iOS-style slide transitions on Android
- Wallet-style gradient net-worth card with a smooth sparkline and balances that count up; Fitness-style concentric activity rings
- Springy press feedback on cards, tiles, chips and buttons; sections rise into place on open; tab icons bounce when selected; task checkmarks pop
- Settings-style filled icon tiles, green toggles, soft layered shadows (none in dark mode), continuous rounded corners, refined sheets, text fields and empty states

**Cards from every bank**
- Watch every bank (on by default): every bank SMS scan also checks alerts from banks you haven't added, adds them automatically and imports their purchases; instant alerts work for them too
- New cards spotted show on Home with what was spent on them: add one as a card in a tap, link it to an account you have, or mark it "Not mine"
- Bank SMS reads alerts from any bank you add (CIB, NBE, Banque Misr, QNB, AAIB, AlexBank, Emirates NBD, ADCB, FAB, Mashreq, Al Rajhi, SNB, Telda, valU and more), in English or Arabic, including line-by-line formats like "Card: *7766 / At: JARIR"
- "Find my other banks & cards" checks the last 4 months of messages on the phone for card alerts from senders you haven't added, and adds them in one tap (then re-reads 90 days)
- Money → Cards lists every card number seen in your alerts with its bank, network (Visa, Mastercard, mada, Meeza), credit/debit, this month's and last month's spending, a 6-month chart, top merchants and every purchase, added or not
- Link a card to an account, or create a credit card / bank account for it in one tap, and give it a nickname; a notification tells you when a new card number shows up
- Charges from an unlinked card go to the account named with its digits or from the same bank, instead of whichever credit card happens to be first

**Money & Tasks polish**
- Tasks: quick add understands "~30m", "@Ahmed", "in 3 days", "next monday", "every friday", "this weekend", "tonight" and "25/12"; Tomorrow and Upcoming (with date headers) lists, quick filters (high, deadline, ≤15 min, reminder) and a "quick wins" sort; status markers on each task (overdue, date, repeat, reminder, notes); swipe for Later; "remind me in 1 hour" and "focus on this"; a celebration when today is done and a collapsible "Done today" list; pick 3 from the backlog; checklist progress, "tick all" and notes → steps; meeting countdowns and a Join button; red badges on the Tasks and Money tabs
- Money: swipe a transaction to log it again, flag or delete it; amount chips, last price at the same place and today's limit while logging, with undo; pay a card's minimum or full balance in one tap; "This month at a glance" (payday, no-spend streak, weekday vs weekend, emergency fund); big-expense alert; a 7-day spending chart against your daily limit; budgets, savings and bills summaries with pace and schedule; search by amount (">500", "100-300") and CSV export; 6 months of in/out per account; merchant month-on-month; card payoff, 50/30/20 and cost-per-use calculators

**Latest additions**
- Money: date chips and "save & add another" when logging, note and category suggestions, turn a transaction into a monthly bill, transactions grouped by day with daily totals, exclude accounts from net worth, net-worth change vs last month, "Pay X now" on cards, VAT and salary calculators, SMS inbox sort / dismiss all / show original message, Zakat "mark as paid" logs the payment
- Tasks: long-press a task for a quick menu, sort by priority / deadline / newest, quick add understands "at 5pm", "every week" and "by friday", reschedule to the weekend, carry over last week's goals, routines that start automatically every morning, upcoming/past meetings with overlap warnings
- Life: archive and edit habits, book ratings, checklist notes, occasion years ("turns 30"), Gregorian ↔ Hijri converter, Ashura in Blessed seasons, Mon/Thu and this-Hijri-year fast counts, most consistent sunnah prayer, all-time dhikr total, take all medications for a time in one tap, water +2, sleep goal, weekly mood strip on Home, journal word count, shareable Life insights
- Everywhere: vibration on/off, soft dark mode, a "Largest" text size, choose the tab the app opens on, Asr (Hanafi) setting, pick which prayers get an adhan plus a get-ready reminder, test notification, lock now, cancel a scheduled reminder, search filters by type, Jumu'ah / Ramadan / Eid greetings on Home, tap the Hijri date for the calendar, tap the insight of the day for another, notes export, clear stored bank SMS text, typed confirmation before a reset, app version in Settings

## Tech stack

- Expo SDK 57 (React Native 0.86, React 19), TypeScript, Expo Router
- SQLite via `expo-sqlite`, hand-rolled repositories (no ORM)
- Firebase Authentication + Firestore via `@react-native-firebase/*` (native SDK, offline-first)
- `expo-notifications` for local reminders, `expo-image-picker` for receipt photos
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
