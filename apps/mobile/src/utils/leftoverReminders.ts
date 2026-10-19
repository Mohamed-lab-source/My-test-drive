import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LeftoverEntry } from "../context/LeftoversContext";
import { hasReminderPermission } from "./mealReminders";
import { moveOutOfQuietHours } from "./quietHours";

const SCHEDULED_IDS_KEY = "cookmate.leftoverReminderIds";
const REMINDER_HOUR = 10;
const REMINDER_MINUTE = 0;

/**
 * Same cancel-then-reschedule-everything strategy as mealReminders: cheap
 * enough given how few leftovers are ever tracked at once, and it means a
 * removed or eaten leftover's reminder can never fire late.
 */
export async function rescheduleLeftoverReminders(
  leftovers: LeftoverEntry[],
  enabled: boolean,
  contentFor: (title: string) => { title: string; body: string }
) {
  const storedIds = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
  const previousIds: string[] = storedIds ? JSON.parse(storedIds) : [];
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));

  if (!enabled || !(await hasReminderPermission())) {
    await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify([]));
    return;
  }

  const now = Date.now();
  const newIds: string[] = [];
  for (const entry of leftovers) {
    const [year, month, day] = entry.useByDate.split("-").map(Number);
    const trigger = moveOutOfQuietHours(new Date(year, month - 1, day, REMINDER_HOUR, REMINDER_MINUTE, 0, 0));
    if (trigger.getTime() <= now) continue;
    const { title, body } = contentFor(entry.title);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { leftoverId: entry.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    }).catch(() => null);
    if (id) newIds.push(id);
  }
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(newIds));
}
