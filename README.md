# Anchor

A personal finance and life-organization app, built with Expo (React Native) and an Apple-inspired design system.

Your Money/Tasks/Life data lives on-device in SQLite. Opening the app requires an account (see **Account** below) — currently backed by a local placeholder while a real Firebase project is being connected.

## Account

Anchor opens to a sign-in flow before showing any of your data:

- **Welcome** — Sign In or Create Account
- **Create Account** — a short, animated wizard: name → email → password → done
- **Sign In** — email + password

This is designed against a swappable `AuthBackend` interface (`src/auth/backend.ts`). Right now it's backed by `src/auth/localAuthBackend.ts`, which stores accounts in on-device AsyncStorage as a **temporary stand-in** — it is not secure and not meant to ship as-is. Once a Firebase project is connected (Authentication + Firestore), a `firebaseAuthBackend.ts` replaces it behind that same interface, and the plan is for Money/Tasks/Life data to sync to Firestore under the signed-in account rather than staying purely local.

## Features

**Money**
- Accounts (cash, bank, savings, credit) with running balances
- Income / expense / transfer transactions with categories
- Debts — track what you owe and what's owed to you, with partial payments
- Subscriptions & recurring expenses/income, with next-due tracking
- Savings goals with progress rings and contributions (e.g. a wedding fund)
- Custom categories

**Tasks**
- Today / Backlog / All views
- Priorities, projects, notes
- Meetings with date/time/location

**Life**
- Daily 5-prayer tracker with streaks
- Wishlist / ideas board with priority and price

**Home-screen widgets (Android)**
- Prayers — today's 5 prayers with streak, tap a prayer to mark it done right from the widget
- Today — your tasks scheduled for today; tap the circle to mark a task done, tap + to add one
- Net worth — current net worth and next upcoming bill; tap + to log an expense, tap Pay to post the bill

**Settings**
- Light/Dark/System appearance
- Currency selection
- JSON export/import backup, full reset

## Tech stack

- Expo SDK 57 (React Native 0.86, React 19), TypeScript, Expo Router
- SQLite via `expo-sqlite`, hand-rolled repositories (no ORM)
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
src/auth/             AuthProvider + swappable AuthBackend (local placeholder for now)
src/db/               SQLite schema, client, repositories, backup/restore
src/store/            zustand stores (finance, productivity, life, settings)
src/theme/            colors, typography, spacing, ThemeProvider
src/ui/               reusable design-system components
src/features/         feature-specific components (add sheets, rows) grouped by domain
src/widgets/          Android home-screen widgets (Prayers, Today, Net worth)
```
