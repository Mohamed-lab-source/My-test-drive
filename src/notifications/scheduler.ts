import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../store/settingsStore';
import { findPrayerCity, getPrayerSchedule, type PrayerCity } from '../utils/prayerTimes';
import { todayKey } from '../db/client';
import type { Debt, Meeting, Occasion, RecurringRule, Task } from '../db/types';
import { listOccasions } from '../db/repositories/occasions';

const CHANNEL_ID = 'anchor-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  useSettingsStore.getState().setNotificationsEnabled(granted);
  return granted;
}

// Reminders only actually get scheduled when both the OS permission is
// granted AND the user hasn't turned the in-app toggle back off — the OS
// can't be asked to "un-grant" a permission, so the app-level preference is
// what a toggled-off switch controls.
export async function areNotificationsEnabled(): Promise<boolean> {
  if (!useSettingsStore.getState().notificationsEnabled) return false;
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

function meetingReminderId(meetingId: string): string {
  return `meeting-${meetingId}`;
}
function billReminderId(ruleId: string): string {
  return `bill-${ruleId}`;
}

export async function scheduleMeetingReminder(meeting: Meeting): Promise<void> {
  await cancelMeetingReminder(meeting.id);
  const fireAt = new Date(meeting.start_at).getTime() - meeting.reminder_minutes_before * 60000;
  if (fireAt <= Date.now()) return;
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: meetingReminderId(meeting.id),
    content: {
      title: meeting.title,
      body: meeting.location ? `Starting soon · ${meeting.location}` : 'Starting soon',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
}

export async function cancelMeetingReminder(meetingId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(meetingReminderId(meetingId)).catch(() => {});
}

export async function scheduleBillReminder(rule: RecurringRule): Promise<void> {
  await cancelBillReminder(rule.id);
  if (!rule.is_active || rule.is_paused) return;
  const fireAt = new Date(rule.next_due_date).getTime() - rule.reminder_days_before * 86400000;
  if (fireAt <= Date.now()) return;
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: billReminderId(rule.id),
    content: {
      title: rule.name,
      body: `Due ${rule.reminder_days_before === 1 ? 'tomorrow' : `in ${rule.reminder_days_before} days`}`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
}

export async function cancelBillReminder(ruleId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(billReminderId(ruleId)).catch(() => {});
}

// Brings every pending reminder in line with current data — used when the
// user turns reminders on (so items created while they were off get one) and
// on app launch (so edits synced from another device are reflected).
export async function rescheduleAllReminders(
  meetings: Meeting[],
  rules: RecurringRule[],
  tasks: Task[],
  debts: Debt[] = []
): Promise<void> {
  if (!(await areNotificationsEnabled())) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  for (const m of meetings) await scheduleMeetingReminder(m);
  for (const r of rules) await scheduleBillReminder(r);
  for (const t of tasks) await scheduleTaskReminder(t);
  for (const d of debts) await scheduleDebtReminder(d);
}

function debtReminderId(debtId: string): string {
  return `debt-${debtId}`;
}

// 9 AM the day before the due date, or 9 AM on the day if that's already past.
export async function scheduleDebtReminder(debt: Debt): Promise<void> {
  await cancelDebtReminder(debt.id);
  if (!debt.due_date || debt.status === 'paid') return;
  const due = new Date(debt.due_date);
  const at = (offsetDays: number) => new Date(due.getFullYear(), due.getMonth(), due.getDate() - offsetDays, 9).getTime();
  const fireAt = at(1) > Date.now() ? at(1) : at(0);
  if (fireAt <= Date.now()) return;
  if (!(await areNotificationsEnabled())) return;
  const tomorrow = fireAt === at(1);
  await Notifications.scheduleNotificationAsync({
    identifier: debtReminderId(debt.id),
    content: {
      title: debt.direction === 'i_owe' ? `Pay back ${debt.person_name}` : `${debt.person_name} owes you`,
      body: `Due ${tomorrow ? 'tomorrow' : 'today'}`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
}

export async function cancelDebtReminder(debtId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(debtReminderId(debtId)).catch(() => {});
}

function taskReminderId(taskId: string): string {
  return `task-${taskId}`;
}

export async function scheduleTaskReminder(task: Task): Promise<void> {
  await cancelTaskReminder(task.id);
  if (!task.remind_at || task.status === 'done') return;
  const fireAt = new Date(task.remind_at).getTime();
  if (fireAt <= Date.now()) return;
  if (!(await areNotificationsEnabled())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: taskReminderId(task.id),
    content: { title: task.title, body: 'Task reminder' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(taskReminderId(taskId)).catch(() => {});
}

const FOCUS_ID = 'focus-session';

export async function scheduleFocusEnd(endsAt: number, title: string): Promise<void> {
  await cancelFocusEnd();
  if (!(await areNotificationsEnabled())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: { title: 'Focus session complete', body: title },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt, channelId: CHANNEL_ID },
  });
}

export async function cancelFocusEnd(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}

export async function notifyNow(title: string, body: string): Promise<void> {
  if (!(await areNotificationsEnabled())) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

const PRAYER_PREFIX = 'prayer-';
const PRAYER_DAYS_AHEAD = 3;
const PRAYER_NAMES: Record<string, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

// Replaces all scheduled prayer alerts with the next few days' worth for the
// chosen city. Re-run on every launch so the window keeps rolling forward.
export async function reschedulePrayerAlerts(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PRAYER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const { prayerAlerts, jumuahReminder, prayerCityId } = useSettingsStore.getState();
  const city = findPrayerCity(prayerCityId);
  if (!city || !(await areNotificationsEnabled())) return;

  const now = new Date();
  if (jumuahReminder) await scheduleJumuah(city, now);
  if (!prayerAlerts) return;
  for (let i = 0; i < PRAYER_DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const schedule = getPrayerSchedule(city, day);
    for (const [prayer, time] of Object.entries(schedule)) {
      if (time.getTime() <= now.getTime()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PRAYER_PREFIX}${time.toISOString()}-${prayer}`,
        content: { title: `${PRAYER_NAMES[prayer]} time`, body: `It's time for ${PRAYER_NAMES[prayer]} in ${city.name}` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: time, channelId: CHANNEL_ID },
      });
    }
  }
}

const JUMUAH_LEAD_MINUTES = 60;
const JUMUAH_WEEKS_AHEAD = 2;

// An hour before Dhuhr on the next couple of Fridays — covered by the same
// prefix as the adhan alerts, so it rolls forward on every launch too.
async function scheduleJumuah(city: PrayerCity, now: Date): Promise<void> {
  const daysToFriday = (5 - now.getDay() + 7) % 7;
  for (let w = 0; w < JUMUAH_WEEKS_AHEAD; w++) {
    const friday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToFriday + w * 7);
    const fireAt = getPrayerSchedule(city, friday).dhuhr.getTime() - JUMUAH_LEAD_MINUTES * 60000;
    if (fireAt <= now.getTime()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${PRAYER_PREFIX}jumuah-${todayKey(friday)}`,
      content: { title: "Jumu'ah today", body: 'Ghusl, Surat al-Kahf, and head to the masjid early' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
  }
}

function occasionReminderId(id: string): string {
  return `occasion-${id}`;
}

export async function scheduleOccasionReminder(o: Occasion): Promise<void> {
  await cancelOccasionReminder(o.id);
  if (!(await areNotificationsEnabled())) return;
  const what = o.kind === 'birthday' ? "'s birthday" : o.kind === 'anniversary' ? ' anniversary' : '';
  await Notifications.scheduleNotificationAsync({
    identifier: occasionReminderId(o.id),
    content: { title: `Today: ${o.name}${what}`, body: 'Tap to open Anchor' },
    // Yearly triggers use JS Date ranges: January is 0.
    trigger: { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: o.month - 1, day: o.day, hour: 9, minute: 0, channelId: CHANNEL_ID },
  });
}

export async function cancelOccasionReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(occasionReminderId(id)).catch(() => {});
}

export async function rescheduleOccasionReminders(): Promise<void> {
  for (const o of await listOccasions()) await scheduleOccasionReminder(o);
}
