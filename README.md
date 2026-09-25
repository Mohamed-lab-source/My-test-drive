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
- Custom categories

**Tasks**
- Today / Backlog / All views, with unfinished "Today" tasks rolling into Backlog automatically
- Priorities, projects (with a dedicated Projects screen and manual reordering), notes, subtasks/checklists
- Recurring tasks that regenerate their next occurrence on completion
- Meetings with date/time/location and reminder notifications
- Agenda view merging tasks and meetings by day for the next two weeks

**Life**
- Daily 5-prayer tracker with streaks
- Wishlist / ideas board with priority and price, with one-tap "save up for this" to spin up a savings goal
- General-purpose habit streak tracker for any custom daily habit
- Daily journal / mood check-in

**Home-screen widgets (Android)**
- Prayers — today's 5 prayers with streak, tap a prayer to mark it done right from the widget
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
src/notifications/    local notification scheduling (meeting + bill-due reminders)
src/store/            zustand stores (finance, productivity, life, habits, settings)
src/theme/            colors, typography, spacing, ThemeProvider
src/ui/               reusable design-system components
src/features/         feature-specific components (add sheets, rows) grouped by domain
src/widgets/          Android home-screen widgets (Prayers, Today, Net worth)
```
