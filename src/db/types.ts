export type CategoryKind = 'expense' | 'income' | 'both';
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  is_archived: number;
  sort_order: number;
}

export type AccountType = 'cash' | 'bank' | 'savings' | 'credit' | 'wallet';
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  is_archived: number;
  sort_order: number;
  created_at: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface RecurringRule {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category_id: string | null;
  account_id: string | null;
  frequency: RecurringFrequency;
  interval_count: number;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  is_active: number;
  is_subscription: number;
  icon: string;
  color: string;
  reminder_days_before: number;
  notes: string | null;
  created_at: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  account_id: string | null;
  transfer_to_account_id: string | null;
  category_id: string | null;
  recurring_id: string | null;
  note: string | null;
  date: string;
  created_at: string;
}

export type DebtDirection = 'owed_to_me' | 'i_owe';
export type DebtStatus = 'open' | 'partially_paid' | 'paid';
export interface Debt {
  id: string;
  direction: DebtDirection;
  person_name: string;
  principal_amount: number;
  remaining_amount: number;
  currency: string;
  due_date: string | null;
  status: DebtStatus;
  notes: string | null;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  icon: string;
  color: string;
  notes: string | null;
  is_completed: number;
  created_at: string;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  note: string | null;
}

export type WishlistPriority = 'low' | 'medium' | 'high';
export type WishlistStatus = 'idea' | 'planned' | 'purchased' | 'dropped';
export interface WishlistItem {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string | null;
  priority: WishlistPriority;
  status: WishlistStatus;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: number;
  sort_order: number;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  start_at: string;
  end_at: string | null;
  reminder_minutes_before: number;
  created_at: string;
}

// Atomic Habits row shapes (raw SQLite rows — JSON-encoded columns are
// serialized/parsed to the rich domain types in src/domain/habits).
export interface IdentityRow {
  id: string;
  statement: string;
  why: string | null;
  is_archived: number;
  created_at: string;
}

export interface AtomicHabitRow {
  id: string;
  name: string;
  icon: string;
  identity_id: string | null;
  frequency_type: 'daily' | 'weekdays';
  frequency_days: string | null; // JSON number[]
  time_of_day: 'anytime' | 'morning' | 'afternoon' | 'evening';
  cue: string;
  craving: string;
  response: string;
  reward: string;
  two_minute_version: string;
  stack_anchor_type: 'none' | 'habit' | 'custom';
  stack_anchor_habit_id: string | null;
  stack_anchor_text: string | null;
  sort_order: number;
  tags: string; // JSON string[]
  is_archived: number;
  created_at: string;
}

export interface CheckInRow {
  id: string;
  habit_id: string;
  date: string;
  completed_full: number;
  used_two_minute_version: number;
  skipped: number;
  frozen: number;
  note: string | null;
  created_at: string;
}

export type ScorecardRating = '+' | '-' | '=';
export interface ScorecardEntryRow {
  id: string;
  activity: string;
  rating: ScorecardRating;
  note: string | null;
  created_at: string;
}

export type Prayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export interface PrayerLog {
  id: string;
  date: string;
  prayer: Prayer;
  completed: number;
  completed_at: string | null;
}

export const PRAYERS: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
