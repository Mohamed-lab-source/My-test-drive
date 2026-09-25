import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../store/settingsStore';
import type { Meeting, RecurringRule } from '../db/types';

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
