// SQLite schema for the app's local-first database.
// All money amounts are stored as integer minor units (cents) to avoid float drift.

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'both')),
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'savings', 'credit', 'wallet')),
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_subscription INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  reminder_days_before INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  transfer_to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  recurring_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('owed_to_me', 'i_owe')),
  person_name TEXT NOT NULL,
  principal_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'partially_paid', 'paid')) DEFAULT 'open',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY NOT NULL,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL,
  current_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_date TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  notes TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  price INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  url TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('idea', 'planned', 'purchased', 'dropped')) DEFAULT 'idea',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done')) DEFAULT 'todo',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  due_date TEXT,
  scheduled_date TEXT,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(start_at);

-- Atomic Habits methodology: identities you're building, habits designed
-- around the Four Laws, daily check-ins with a streak-freeze economy, and a
-- habits scorecard. Ported from the standalone "Atomic" app.

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY NOT NULL,
  statement TEXT NOT NULL,
  why TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS atomic_habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  identity_id TEXT REFERENCES identities(id) ON DELETE SET NULL,
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekdays')),
  frequency_days TEXT,
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening')) DEFAULT 'anytime',
  cue TEXT NOT NULL DEFAULT '',
  craving TEXT NOT NULL DEFAULT '',
  response TEXT NOT NULL DEFAULT '',
  reward TEXT NOT NULL DEFAULT '',
  two_minute_version TEXT NOT NULL DEFAULT '',
  stack_anchor_type TEXT NOT NULL CHECK (stack_anchor_type IN ('none', 'habit', 'custom')) DEFAULT 'none',
  stack_anchor_habit_id TEXT REFERENCES atomic_habits(id) ON DELETE SET NULL,
  stack_anchor_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL REFERENCES atomic_habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_full INTEGER NOT NULL DEFAULT 0,
  used_two_minute_version INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_habit ON checkins(habit_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);

CREATE TABLE IF NOT EXISTS scorecard_entries (
  id TEXT PRIMARY KEY NOT NULL,
  activity TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('+', '-', '=')),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prayer_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  completed INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  UNIQUE(date, prayer)
);
`;
