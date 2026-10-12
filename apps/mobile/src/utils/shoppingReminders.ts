import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasReminderPermission } from "./mealReminders";

const SCHEDULED_ID_KEY = "cookmate.shoppingReminderId";
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 0;

/**
 * A single recurring weekly reminder, independent of any specific plan data
 * -- unlike mealReminders/leftoverReminders there's nothing to cancel and
 * reschedule per item, just one notification to replace whenever the
 * enabled flag or chosen day changes.
 *
 * @param jsWeekday 0 (Sunday) through 6 (Saturday), matching `Date#getDay()`
 * -- converted here to expo-notifications' own 1 (Sunday) through 7 (Saturday).
 */
export async function rescheduleShoppingReminder(
  enabled: boolean,
  jsWeekday: number,
  content: { title: string; body: string }
) {
  const storedId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
  if (storedId) {
    await Notifications.cancelScheduledNotificationAsync(storedId).catch(() => {});
    await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
  }

  if (!enabled || !(await hasReminderPermission())) return;

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: jsWeekday + 1,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  }).catch(() => null);
  if (id) await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
}
