import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../store/settingsStore';
import { findPrayerCity, getPrayerSchedule, type PrayerCity } from '../utils/prayerTimes';
import { todayKey } from '../db/client';
import type { Debt, Habit, Medication, Meeting, Occasion, RecurringRule, Task } from '../db/types';
import { islamicDay, toHijri, HIJRI_MONTHS } from '../utils/hijri';
import { localDateKey } from '../utils/date';
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

// ---------- Habit reminders (daily, at the habit's chosen time) ----------
export const HABIT_REMINDER_TIMES = ['07:00', '12:00', '18:00', '21:00'];

function habitReminderId(habitId: string): string {
  return `habit-${habitId}`;
}

export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  await cancelHabitReminder(habit.id);
  if (!habit.remind_time || habit.is_archived) return;
  if (!(await areNotificationsEnabled())) return;
  const [hour, minute] = habit.remind_time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: habitReminderId(habit.id),
    content: { title: habit.name, body: 'Keep your streak going' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(habitReminderId(habitId)).catch(() => {});
}

export async function rescheduleHabitReminders(habits: Habit[]): Promise<void> {
  for (const h of habits) await scheduleHabitReminder(h);
}

// ---------- Sunnah fast reminders (evening before) ----------
const SUNNAH_PREFIX = 'sunnahfast-';
const SUNNAH_DAYS_AHEAD = 60;
const SUNNAH_REMINDER_HOUR = 20;

export async function rescheduleSunnahFastReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(SUNNAH_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const { sunnahFastReminders, hijriOffset } = useSettingsStore.getState();
  if (!sunnahFastReminders || !(await areNotificationsEnabled())) return;

  const now = new Date();
  let previous = '';
  for (let i = 1; i <= SUNNAH_DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const hijri = toHijri(day, hijriOffset);
    const info = islamicDay(hijri);
    const label = info?.kind === 'fast' ? info.label : '';
    // One reminder per run of fasting days (e.g. the three white days).
    if (label && label !== previous && !(label === 'Ashura' && previous === "Tasu'a")) {
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, SUNNAH_REMINDER_HOUR);
      if (fireAt.getTime() > now.getTime()) {
        const body =
          label === 'White days'
            ? `The white days (13–15 ${HIJRI_MONTHS[hijri.month - 1]}) start tomorrow`
            : label === "Tasu'a"
              ? "Tasu'a and Ashura are tomorrow and the day after"
              : `${label} is tomorrow`;
        await Notifications.scheduleNotificationAsync({
          identifier: `${SUNNAH_PREFIX}${todayKey(day)}`,
          content: { title: 'Sunnah fast tomorrow', body: `${body} — set your suhoor alarm.` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
        });
      }
    }
    previous = label;
  }
}

// ---------- Morning briefing & evening journal ----------
const BRIEFING_ID = 'morning-briefing';
const BRIEFING_HOUR = 8;
const JOURNAL_ID = 'evening-journal';
const JOURNAL_HOUR = 21;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Content is computed now for the next 8 AM, so this is re-run on every
// launch (and whenever the data behind it changes enough to matter).
export async function scheduleMorningBriefing(data: { tasks: Task[]; meetings: Meeting[]; rules: RecurringRule[] }): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(() => {});
  if (!useSettingsStore.getState().morningBriefing || !(await areNotificationsEnabled())) return;

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), BRIEFING_HOUR);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const key = todayKey(target);

  const tasks = data.tasks.filter((t) => t.status !== 'done' && (t.scheduled_date === key || t.status === 'in_progress'));
  const meetings = data.meetings.filter((m) => localDateKey(m.start_at) === key);
  const bills = data.rules.filter((r) => r.is_active && !r.is_paused && r.type === 'expense' && localDateKey(r.next_due_date) <= key);
  const parts = [
    tasks.length ? plural(tasks.length, 'task') : null,
    meetings.length ? plural(meetings.length, 'meeting') : null,
    bills.length ? `${plural(bills.length, 'bill')} due` : null,
  ].filter(Boolean);

  await Notifications.scheduleNotificationAsync({
    identifier: BRIEFING_ID,
    content: {
      title: 'Good morning',
      body: parts.length ? `Today: ${parts.join(', ')}.` : 'A clear day — plan something from your backlog?',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target, channelId: CHANNEL_ID },
  });
}

export async function scheduleEveningJournal(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(JOURNAL_ID).catch(() => {});
  if (!useSettingsStore.getState().eveningJournal || !(await areNotificationsEnabled())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: JOURNAL_ID,
    content: { title: 'How was today?', body: "Take a moment to log your mood and what you're grateful for." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: JOURNAL_HOUR, minute: 0, channelId: CHANNEL_ID },
  });
}

// ---------- Water reminders ----------
const WATER_PREFIX = 'water-';
const WATER_HOURS = [9, 11, 13, 15, 17, 19, 21];

export async function scheduleWaterReminders(): Promise<void> {
  await Promise.all(WATER_HOURS.map((h) => Notifications.cancelScheduledNotificationAsync(`${WATER_PREFIX}${h}`).catch(() => {})));
  if (!useSettingsStore.getState().waterReminders || !(await areNotificationsEnabled())) return;
  for (const hour of WATER_HOURS) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${WATER_PREFIX}${hour}`,
      content: { title: 'Time for some water 💧', body: 'Tap to log a glass in Anchor' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL_ID },
    });
  }
}

// ---------- Medication reminders ----------
const MED_PREFIX = 'med-';

export async function rescheduleMedicationReminders(meds: Medication[], timesOf: (m: Medication) => string[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(MED_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  if (!(await areNotificationsEnabled())) return;
  for (const m of meds) {
    if (!m.is_active) continue;
    for (const time of timesOf(m)) {
      const [hour, minute] = time.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        identifier: `${MED_PREFIX}${m.id}-${time}`,
        content: { title: `💊 ${m.name}`, body: m.dose ? `Time to take ${m.dose}` : 'Time to take your medication' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
      });
    }
  }
}

// ---------- Bedtime ----------
const BEDTIME_ID = 'bedtime';

export async function scheduleBedtimeReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BEDTIME_ID).catch(() => {});
  const { bedtime } = useSettingsStore.getState();
  if (!bedtime || !(await areNotificationsEnabled())) return;
  const [hour, minute] = bedtime.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: BEDTIME_ID,
    content: { title: 'Time to wind down 🌙', body: 'Put the phone away, read your evening adhkar and get some rest.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
}

// ---------- Islamic occasions, Mon/Thu fasts, zakat hawl ----------
const ISLAMIC_PREFIXES = ['occ-', 'monthu-', 'hawl-'];
const OCCASION_LABELS = new Set(['Ramadan begins', 'Eid al-Fitr', 'Eid al-Adha', 'Islamic New Year', 'Last ten nights']);

async function scheduleAt(identifier: string, date: Date, title: string, body: string): Promise<void> {
  if (date.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
  });
}

export async function rescheduleIslamicReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => ISLAMIC_PREFIXES.some((p) => n.identifier.startsWith(p)))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const { occasionReminders, monThuReminders, zakatHawl, hijriOffset } = useSettingsStore.getState();
  if (!(await areNotificationsEnabled())) return;
  const now = new Date();
  const day = (offset: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour);

  if (occasionReminders) {
    let previous = '';
    for (let i = 0; i <= 400; i++) {
      const date = day(i, 12);
      const info = islamicDay(toHijri(date, hijriOffset));
      const label = info && OCCASION_LABELS.has(info.label) ? info.label : '';
      if (label && label !== previous) {
        const key = todayKey(date);
        if (label === 'Ramadan begins') {
          await scheduleAt(`occ-${key}-eve`, day(i - 1, 20), 'Ramadan starts tomorrow 🌙', 'Ramadan Mubarak — set your suhoor alarm tonight.');
        } else if (label === 'Last ten nights') {
          await scheduleAt(`occ-${key}`, day(i, 17), 'The last ten nights begin tonight', 'Seek Laylat al-Qadr in the odd nights.');
        } else if (label.startsWith('Eid')) {
          await scheduleAt(`occ-${key}`, day(i, 8), `${label} Mubarak 🎉`, 'Taqabbal Allahu minna wa minkum.');
        } else {
          await scheduleAt(`occ-${key}`, day(i, 9), label, `Today is the ${label}.`);
        }
      }
      previous = label;
    }
  }

  if (monThuReminders) {
    // Sunday and Wednesday evenings for the next four weeks.
    for (let i = 0; i < 28; i++) {
      const eve = day(i, 20);
      const dow = eve.getDay();
      if (dow !== 0 && dow !== 3) continue;
      const tomorrow = dow === 0 ? 'Monday' : 'Thursday';
      await scheduleAt(`monthu-${todayKey(eve)}`, eve, `Fast tomorrow? (${tomorrow})`, `${tomorrow} is a sunnah fasting day — set your suhoor alarm.`);
    }
  }

  if (zakatHawl) {
    // The next Gregorian day that falls on the chosen Hijri month/day.
    for (let i = 0; i <= 400; i++) {
      const date = day(i, 9);
      const h = toHijri(date, hijriOffset);
      if (h.month === zakatHawl.month && h.day === zakatHawl.day) {
        await scheduleAt(
          `hawl-${todayKey(date)}`,
          date,
          'Your zakat year is complete',
          'A lunar year has passed on your savings — open Anchor to calculate your zakat.'
        );
        break;
      }
    }
  }
}
