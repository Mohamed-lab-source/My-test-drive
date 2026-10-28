// Widget JSX builders keyed by data pulled straight from the DB. Shared
// between the headless widget-task-handler (no app running, no store
// hydration) and the in-app refresh helpers, so it never assumes a
// Zustand store is hydrated — it reads AsyncStorage/SQLite directly.
// Each widget loads its data once and builds both light and dark looks,
// sized to the widget as it sits on the home screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey } from '../db/client';
import * as lifeRepo from '../db/repositories/life';
import * as productivityRepo from '../db/repositories/productivity';
import * as financeRepo from '../db/repositories/finance';
import * as habitsRepo from '../db/repositories/habits';
import * as healthRepo from '../db/repositories/health';
import { listFxRates, convertToBase } from '../db/repositories/fx';
import { formatRelativeDay, formatTime, localDateKey, setUse24hClock } from '../utils/date';
import { formatMoney, setWholeMoney } from '../utils/money';
import { setMonthStartDay } from '../utils/period';
import { findPrayerCity, getPrayerSchedule, setAsrMadhab, setPrayerAdjustments } from '../utils/prayerTimes';
import { HIJRI_MONTHS, islamicDay, toHijri } from '../utils/hijri';
import { meetingLink } from '../utils/meetingInfo';
import { computePlanWith } from '../features/money/planCore';
import type { SpendingPlan } from '../utils/spendingPlan';
import type { Prayer, Task } from '../db/types';
import { PRAYERS } from '../db/types';
import { buildPrayerWidget } from './PrayerWidget';
import { buildTasksWidget, type TasksWidgetTask } from './TasksWidget';
import { buildMoneyWidget } from './MoneyWidget';
import { buildSmartWidget } from './SmartWidget';
import { buildSpendWidget } from './SpendWidget';
import { buildLifeWidget } from './LifeWidget';
import { greeting, pickSmartCards } from './smartEngine';

export type WidgetName = 'PrayerWidget' | 'TasksWidget' | 'MoneyWidget' | 'SmartWidget' | 'SpendWidget' | 'LifeWidget';
export const WIDGET_NAMES: WidgetName[] = ['PrayerWidget', 'TasksWidget', 'MoneyWidget', 'SmartWidget', 'SpendWidget', 'LifeWidget'];

type Scheme = 'light' | 'dark';
// The widget's size on the home screen, in dp.
export interface WidgetSize {
  width: number;
  height: number;
}

interface StoredSettings {
  currency?: string;
  prayerCityId?: string | null;
  prayerAdjust?: Record<string, number>;
  use24h?: boolean;
  wholeMoney?: boolean;
  excludedAccounts?: string[];
  asrMadhab?: 'auto' | 'shafi' | 'hanafi';
  hijriOffset?: number;
  waterGoal?: number;
  weekStart?: number;
  monthlyIncome?: number;
  savingsPct?: number;
  dailySpendAlert?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  monthStartDay?: number;
}

async function readSettings(): Promise<StoredSettings> {
  try {
    const raw = await AsyncStorage.getItem('anchor-settings');
    const state = (raw ? JSON.parse(raw) : null)?.state ?? {};
    // The headless widget task never runs the app's startup code.
    setUse24hClock(!!state.use24h);
    setWholeMoney(!!state.wholeMoney);
    setMonthStartDay(state.monthStartDay ?? 1);
    setPrayerAdjustments(state.prayerAdjust ?? {});
    setAsrMadhab(state.asrMadhab ?? 'auto');
    return state;
  } catch {
    return {};
  }
}

const PRAYER_NAMES: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const time = (d: Date) => formatTime(d.toISOString());
const dateKeyOf = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : localDateKey(v));

function hijriShort(now: Date, offset: number): string {
  const h = toHijri(now, offset);
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]}`;
}

// Today's prayer times, which one's time it is now and which comes next.
function prayerDay(s: StoredSettings, now: Date) {
  const city = findPrayerCity(s.prayerCityId ?? null);
  if (!city) return null;
  const today = getPrayerSchedule(city, now);
  const nextFajr = getPrayerSchedule(city, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).fajr;
  let current: Prayer | null = null;
  let next: Prayer | null = null;
  PRAYERS.forEach((p, i) => {
    const end = i < PRAYERS.length - 1 ? today[PRAYERS[i + 1]] : nextFajr;
    if (today[p] <= now && now < end) current = p;
    if (!next && today[p] > now) next = p;
  });
  return { today, nextFajr, current: current as Prayer | null, next: next as Prayer | null };
}

// Open tasks for today plus overdue ones, most important first.
function todaysTasks(all: Task[], now: Date): TasksWidgetTask[] {
  const today = todayKey(now);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return all
    .filter((t) => t.status !== 'done' && t.status !== 'backlog' && ((t.scheduled_date && t.scheduled_date <= today) || t.status === 'in_progress' || (t.due_date && dateKeyOf(t.due_date) <= today)))
    .map((t) => {
      const remind = t.remind_at ? new Date(t.remind_at) : null;
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        overdue: (!!t.scheduled_date && t.scheduled_date < today) || (!!t.due_date && dateKeyOf(t.due_date) < today),
        deadlineToday: !!t.due_date && dateKeyOf(t.due_date) === today,
        time: remind && localDateKey(remind.toISOString()) === today ? time(remind) : null,
        remindAt: remind,
      };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.deadlineToday) - Number(a.deadlineToday) ||
        rank[a.priority] - rank[b.priority] ||
        (a.remindAt?.getTime() ?? Infinity) - (b.remindAt?.getTime() ?? Infinity)
    )
    .map(({ remindAt: _r, ...t }) => t);
}

async function loadPlan(s: StoredSettings, now: Date): Promise<SpendingPlan | null> {
  try {
    const [fxRates, recurringRules, savingsGoals] = await Promise.all([listFxRates(), financeRepo.listRecurringRules(), financeRepo.listSavingsGoals()]);
    return await computePlanWith(now, {
      settings: {
        currency: s.currency ?? 'USD',
        weekStart: s.weekStart ?? 6,
        monthlyIncome: s.monthlyIncome ?? 0,
        savingsPct: s.savingsPct ?? 0,
        dailySpendAlert: s.dailySpendAlert ?? 0,
        weeklyLimit: s.weeklyLimit ?? 0,
        monthlyLimit: s.monthlyLimit ?? 0,
        monthStartDay: s.monthStartDay ?? 1,
      },
      fxRates,
      recurringRules,
      savingsGoals,
    });
  } catch {
    return null;
  }
}

async function loadHabits(now: Date) {
  const [habits, logs] = await Promise.all([habitsRepo.listHabits(), habitsRepo.listHabitLogsForDate(todayKey(now))]);
  const streaks = await Promise.all(habits.map((h) => habitsRepo.computeHabitStreak(h.id).catch(() => 0)));
  return habits.map((h, i) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    done: logs.some((l) => l.habit_id === h.id && l.completed === 1),
    streak: streaks[i],
  }));
}

type Builder = (scheme: Scheme) => ReturnType<typeof buildPrayerWidget>;

async function prayerBuilder(): Promise<Builder> {
  const now = new Date();
  const s = await readSettings();
  const [logs, streak] = await Promise.all([lifeRepo.listPrayerLogsForDate(todayKey(now)), lifeRepo.computePrayerStreak()]);
  const day = prayerDay(s, now);
  const nextPrayer = day ? (day.next ? `${PRAYER_NAMES[day.next]} ${time(day.today[day.next])}` : `Fajr ${time(day.nextFajr)}`) : null;
  const times = day ? Object.fromEntries(PRAYERS.map((p) => [p, time(day.today[p])])) : null;
  const hijri = hijriShort(now, s.hijriOffset ?? 0);
  return (scheme) => buildPrayerWidget({ logs, streak, nextPrayer, times, current: day?.current ?? null, next: day?.next ?? null, hijri }, scheme);
}

async function tasksBuilder(size: WidgetSize): Promise<Builder> {
  const now = new Date();
  const all = await productivityRepo.listTasks();
  const today = todayKey(now);
  const tomorrowKey = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const tasks = todaysTasks(all, now);
  const doneToday = all.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === today).length;
  const tomorrow = all.filter((t) => t.status !== 'done' && t.scheduled_date === tomorrowKey).map((t) => t.title);
  return (scheme) => buildTasksWidget({ tasks, doneToday, tomorrow }, scheme, size.height);
}

async function moneyBuilder(size: WidgetSize): Promise<Builder> {
  const now = new Date();
  const s = await readSettings();
  const currency = s.currency ?? 'USD';
  const [accounts, recurringRules, fxRates, snapshots, plan] = await Promise.all([
    financeRepo.listAccounts(),
    financeRepo.listRecurringRules(),
    listFxRates(),
    financeRepo.listNetWorthSnapshots(40),
    loadPlan(s, now),
  ]);
  const excluded = s.excludedAccounts ?? [];
  const netWorthMinor = accounts.filter((a) => !excluded.includes(a.id)).reduce((sum, a) => sum + convertToBase(a.balance, a.currency, currency, fxRates), 0);
  const nextRule = recurringRules
    .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
    .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())[0];
  const nextBill = nextRule
    ? { ruleId: nextRule.id, name: nextRule.name, amountMinor: nextRule.amount, currency: nextRule.currency, dueLabel: formatRelativeDay(nextRule.next_due_date) }
    : null;
  // Snapshots in the base currency, oldest first, for the last 30 days.
  const since = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
  const points = snapshots
    .filter((p) => p.currency === currency && p.id >= since)
    .sort((a, b) => a.id.localeCompare(b.id));
  const monthKey = todayKey(now).slice(0, 7);
  const monthStart = points.find((p) => p.id.startsWith(monthKey));
  const history = [...points.map((p) => p.amount), netWorthMinor];
  return (scheme) =>
    buildMoneyWidget(
      {
        netWorthMinor,
        currency,
        nextBill,
        monthChange: monthStart ? netWorthMinor - monthStart.amount : null,
        history: history.length >= 3 ? history : [],
        spentToday: plan?.daily.spent ?? 0,
        dailyLimit: plan?.daily.limit ?? 0,
      },
      scheme,
      size.height
    );
}

async function spendBuilder(size: WidgetSize): Promise<Builder> {
  const now = new Date();
  const s = await readSettings();
  const plan = await loadPlan(s, now);
  const data = plan
    ? {
        currency: s.currency ?? 'USD',
        spentToday: plan.daily.spent,
        daily: plan.daily.limit,
        week: { spent: plan.weekly.spent, limit: plan.weekly.limit },
        month: { spent: plan.monthly.spent, limit: plan.monthly.limit },
        status: plan.status,
        projectedMonthEnd: plan.projectedMonthEnd,
        daysLeft: plan.daysLeft,
      }
    : null;
  return (scheme) => buildSpendWidget(data, scheme, size.height);
}

async function lifeBuilder(size: WidgetSize): Promise<Builder> {
  const now = new Date();
  const s = await readSettings();
  const [habits, water] = await Promise.all([loadHabits(now), healthRepo.getWater(todayKey(now))]);
  return (scheme) => buildLifeWidget({ habits, water: { count: water, goal: s.waterGoal ?? 8 } }, scheme, size.height);
}

async function smartBuilder(size: WidgetSize): Promise<Builder> {
  const now = new Date();
  const s = await readSettings();
  const currency = s.currency ?? 'USD';
  const today = todayKey(now);
  const tomorrowKey = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const [logs, allTasks, meetings, rules, plan, habits, water] = await Promise.all([
    lifeRepo.listPrayerLogsForDate(today),
    productivityRepo.listTasks(),
    productivityRepo.listUpcomingMeetings(new Date(now.getTime() - 3 * 3600000).toISOString()),
    financeRepo.listRecurringRules(),
    loadPlan(s, now),
    loadHabits(now),
    healthRepo.getWater(today),
  ]);
  const day = prayerDay(s, now);
  const open = todaysTasks(allTasks, now);
  const remindById = new Map(allTasks.map((t) => [t.id, t.remind_at ? new Date(t.remind_at) : null]));
  const hijri = toHijri(now, s.hijriOffset ?? 0);
  const special = islamicDay(hijri);

  const cards = pickSmartCards({
    now,
    prayers: day
      ? PRAYERS.map((p) => ({ prayer: p, label: PRAYER_NAMES[p], time: day.today[p], done: logs.some((l) => l.prayer === p && l.completed === 1) }))
      : null,
    nextFajr: day?.nextFajr ?? null,
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      start: new Date(m.start_at),
      end: m.end_at ? new Date(m.end_at) : null,
      link: meetingLink(m),
    })),
    tasks: open.map((t) => ({ id: t.id, title: t.title, priority: t.priority, overdue: t.overdue, deadlineToday: t.deadlineToday, remindAt: remindById.get(t.id) ?? null })),
    doneToday: allTasks.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === today).length,
    tomorrowTasks: allTasks.filter((t) => t.status !== 'done' && t.scheduled_date === tomorrowKey).length,
    bills: rules
      .filter((r) => r.is_active && !r.is_paused && r.type === 'expense')
      .map((r) => ({ ruleId: r.id, name: r.name, amount: formatMoney(r.amount, r.currency), due: new Date(r.next_due_date) })),
    spend: plan ? { spentToday: plan.daily.spent, dailyLimit: plan.daily.limit, status: plan.status } : null,
    habits,
    water: { count: water, goal: s.waterGoal ?? 8 },
    islamicDay: special?.label ?? null,
    money: (n) => formatMoney(Math.round(n), currency),
    time,
  });
  const dateLine = `${now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${hijri.day} ${HIJRI_MONTHS[hijri.month - 1]}`;
  return (scheme) => buildSmartWidget({ cards, greeting: greeting(now), dateLine }, scheme, size.height);
}

const DEFAULT_SIZE: WidgetSize = { width: 250, height: 180 };

function builderFor(name: string, size: WidgetSize): Promise<Builder> {
  switch (name as WidgetName) {
    case 'PrayerWidget':
      return prayerBuilder();
    case 'TasksWidget':
      return tasksBuilder(size);
    case 'MoneyWidget':
      return moneyBuilder(size);
    case 'SmartWidget':
      return smartBuilder(size);
    case 'SpendWidget':
      return spendBuilder(size);
    case 'LifeWidget':
      return lifeBuilder(size);
    default:
      throw new Error(`Unknown widget: ${name}`);
  }
}

// The widget's look for both colour schemes, for in-app previews.
export async function widgetBuilder(name: WidgetName, size: WidgetSize = DEFAULT_SIZE) {
  return builderFor(name, size);
}

export async function renderWidgetByName(name: string, scheme: Scheme, size: WidgetSize = DEFAULT_SIZE) {
  return (await builderFor(name, size))(scheme);
}

export async function renderBothSchemes(name: string, size: WidgetSize = DEFAULT_SIZE) {
  const build = await builderFor(name, size);
  return { light: build('light'), dark: build('dark') };
}
