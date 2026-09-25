// Widget JSX builders keyed by data pulled straight from the DB. Shared
// between the headless widget-task-handler (no app running, no store
// hydration) and the in-app refresh helpers, so it never assumes a
// Zustand store is hydrated — it reads AsyncStorage/SQLite directly.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey } from '../db/client';
import * as lifeRepo from '../db/repositories/life';
import * as productivityRepo from '../db/repositories/productivity';
import * as financeRepo from '../db/repositories/finance';
import { listFxRates, convertToBase } from '../db/repositories/fx';
import { formatRelativeDay } from '../utils/date';
import { buildPrayerWidget } from './PrayerWidget';
import { buildTasksWidget } from './TasksWidget';
import { buildMoneyWidget } from './MoneyWidget';

export type WidgetName = 'PrayerWidget' | 'TasksWidget' | 'MoneyWidget';
export const WIDGET_NAMES: WidgetName[] = ['PrayerWidget', 'TasksWidget', 'MoneyWidget'];

async function getCurrency(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('anchor-settings');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state?.currency ?? 'USD';
  } catch {
    return 'USD';
  }
}

export async function renderPrayerWidget(scheme: 'light' | 'dark') {
  const [logs, streak] = await Promise.all([
    lifeRepo.listPrayerLogsForDate(todayKey()),
    lifeRepo.computePrayerStreak(),
  ]);
  return buildPrayerWidget({ logs, streak }, scheme);
}

export async function renderTasksWidget(scheme: 'light' | 'dark') {
  const all = await productivityRepo.listTasks();
  const today = todayKey();
  const tasks = all.filter(
    (t) => t.status !== 'done' && (t.scheduled_date === today || t.status === 'in_progress')
  );
  return buildTasksWidget({ tasks }, scheme);
}

export async function renderMoneyWidget(scheme: 'light' | 'dark') {
  const [accounts, recurringRules, currency, fxRates] = await Promise.all([
    financeRepo.listAccounts(),
    financeRepo.listRecurringRules(),
    getCurrency(),
    listFxRates(),
  ]);
  const netWorthMinor = accounts.reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0);
  const nextRule = recurringRules
    .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
    .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())[0];
  const nextBill = nextRule
    ? {
        ruleId: nextRule.id,
        name: nextRule.name,
        amountMinor: nextRule.amount,
        currency: nextRule.currency,
        dueLabel: formatRelativeDay(nextRule.next_due_date),
      }
    : null;
  return buildMoneyWidget({ netWorthMinor, currency, nextBill }, scheme);
}

export async function renderWidgetByName(name: string, scheme: 'light' | 'dark') {
  switch (name as WidgetName) {
    case 'PrayerWidget':
      return renderPrayerWidget(scheme);
    case 'TasksWidget':
      return renderTasksWidget(scheme);
    case 'MoneyWidget':
      return renderMoneyWidget(scheme);
    default:
      throw new Error(`Unknown widget: ${name}`);
  }
}

export async function renderBothSchemes(name: string) {
  const [light, dark] = await Promise.all([
    renderWidgetByName(name, 'light'),
    renderWidgetByName(name, 'dark'),
  ]);
  return { light, dark };
}
