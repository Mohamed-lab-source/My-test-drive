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

CREATE TABLE IF NOT EXISTS prayer_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  completed INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  UNIQUE(date, prayer)
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  UNIQUE(habit_id, date)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'low', 'rough')),
  note TEXT,
  created_at TEXT NOT NULL
);

-- id is the currency code itself, so this plugs into the same generic
-- insertRow/updateRow/getRow helpers (and their id-keyed WHERE clauses,
-- Firestore sync, and JSON backup) as every other table.
CREATE TABLE IF NOT EXISTS fx_rates (
  id TEXT PRIMARY KEY NOT NULL,
  currency TEXT NOT NULL UNIQUE,
  rate_to_base REAL NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// Columns added to already-shipped tables after their initial release. A
// fresh install gets these from CREATE TABLE above; an existing on-device
// database predates them, so client.ts applies these as ALTER TABLE
// migrations, guarded by checking PRAGMA table_info first (SQLite has no
// "ADD COLUMN IF NOT EXISTS").
export const COLUMN_MIGRATIONS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'transactions', column: 'receipt_uri', ddl: 'ALTER TABLE transactions ADD COLUMN receipt_uri TEXT' },
  {
    table: 'recurring_rules',
    column: 'is_paused',
    ddl: 'ALTER TABLE recurring_rules ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0',
  },
  { table: 'tasks', column: 'repeat_frequency', ddl: 'ALTER TABLE tasks ADD COLUMN repeat_frequency TEXT' },
  { table: 'tasks', column: 'repeat_interval', ddl: 'ALTER TABLE tasks ADD COLUMN repeat_interval INTEGER' },
];
