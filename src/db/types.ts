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
  is_paused: number;
  auto_post: number;
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
  receipt_uri: string | null;
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
  repeat_frequency: RecurringFrequency | null;
  repeat_interval: number | null;
  remind_at: string | null;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: number;
  sort_order: number;
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

export type Prayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export interface PrayerLog {
  id: string;
  date: string;
  prayer: Prayer;
  completed: number;
  completed_at: string | null;
}

export const PRAYERS: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
  currency: string;
  created_at: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: number;
  sort_order: number;
  // 'HH:MM' local time for a daily reminder, or null for none.
  remind_time?: string | null;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  completed: number;
}

export type JournalMood = 'great' | 'good' | 'okay' | 'low' | 'rough';
export interface JournalEntry {
  id: string;
  date: string;
  mood: JournalMood;
  note: string | null;
  // Newline-separated gratitude lines.
  gratitude?: string | null;
  created_at: string;
}

export interface FxRate {
  id: string;
  currency: string;
  rate_to_base: number;
  updated_at: string;
}

export interface DhikrLog {
  id: string;
  date: string;
  count: number;
}

export interface QuranLog {
  id: string;
  date: string;
  pages: number;
  khatm: number;
  created_at: string;
}

export interface FocusSession {
  id: string;
  task_id: string | null;
  minutes: number;
  completed_at: string;
}

export const QURAN_PAGES = 604;

export interface NetWorthSnapshot {
  id: string;
  amount: number;
  currency: string;
}

export type FastKind = 'ramadan' | 'voluntary' | 'makeup';
export interface FastingLog {
  id: string;
  date: string;
  kind: FastKind;
}

export type OccasionKind = 'birthday' | 'anniversary' | 'other';
export interface Occasion {
  id: string;
  name: string;
  month: number;
  day: number;
  kind: OccasionKind;
  created_at: string;
}

export type AdhkarSession = 'morning' | 'evening';

export interface AdhkarLog {
  id: string;
  date: string;
  session: AdhkarSession;
  done: string;
}

export interface QadaCount {
  id: Prayer;
  owed: number;
}

export interface ShoppingItem {
  id: string;
  title: string;
  est_amount: number | null;
  category_id: string | null;
  is_done: number;
  created_at: string;
}

export interface Routine {
  id: string;
  name: string;
  items: string;
  created_at: string;
}

export interface WaterLog {
  id: string;
  count: number;
}

export interface SleepLog {
  id: string;
  hours: number;
}

export interface WeightLog {
  id: string;
  kg: number;
}

export type SunnahPrayerKind = 'fajr_before' | 'duha' | 'dhuhr_rawatib' | 'maghrib_after' | 'isha_after' | 'tahajjud' | 'witr';

export interface SunnahPrayerLog {
  id: string;
  date: string;
  kind: SunnahPrayerKind;
}

export type BookStatus = 'want' | 'reading' | 'finished';

export interface Book {
  id: string;
  title: string;
  author: string | null;
  total_pages: number;
  pages_read: number;
  status: BookStatus;
  finished_at: string | null;
  created_at: string;
}

export interface Countdown {
  id: string;
  title: string;
  date: string;
  created_at: string;
}

export interface Note {
  id: string;
  body: string;
  pinned: number;
  updated_at: string;
  created_at: string;
}

export type SmsImportStatus = 'pending' | 'added' | 'dismissed';

export interface SmsImport {
  id: string;
  sms_date: string;
  sender: string;
  body: string;
  amount: number;
  currency: string;
  merchant: string | null;
  card_last4: string | null;
  kind: 'purchase' | 'withdrawal' | 'transfer' | 'debit' | 'credit';
  status: SmsImportStatus;
  created_at: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  times: string;
  is_active: number;
  created_at: string;
}
