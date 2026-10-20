import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MealPlanMap } from "../context/MealPlanContext";
import { isInQuietHours, moveOutOfQuietHours } from "./quietHours";

const SCHEDULED_IDS_KEY = "cookmate.mealReminderIds";

let handlerConfigured = false;

/** Call once, early, so a triggered reminder actually shows a banner. */
export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // Stay silent during quiet hours (kitchen timers excepted -- they're never scheduled into them).
      shouldPlaySound: !isInQuietHours(new Date()),
      shouldSetBadge: false,
    }),
  });
}

export async function hasReminderPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

export async function requestReminderPermission(): Promise<boolean> {
  const settings = await Notifications.requestPermissionsAsync();
  return settings.granted;
}

/**
 * Cancels every reminder this app previously scheduled, then -- if enabled and
 * permitted -- schedules one per future-dated planned recipe. Called whenever
 * the plan, the enabled flag, the reminder time, or the locale changes, so it
 * always fully replaces the previous schedule rather than layering on top of it.
 */
export async function rescheduleMealReminders(
  plan: MealPlanMap,
  enabled: boolean,
  time: { hour: number; minute: number },
  contentFor: (recipeTitle: string) => { title: string; body: string }
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
  for (const [dateKey, recipe] of Object.entries(plan)) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const trigger = moveOutOfQuietHours(new Date(year, month - 1, day, time.hour, time.minute, 0, 0));
    if (trigger.getTime() <= now) continue;
    const { title, body } = contentFor(recipe.title);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { recipeSlug: recipe.slug } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    }).catch(() => null);
    if (id) newIds.push(id);
  }
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(newIds));
}
