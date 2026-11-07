// Called from the running app after a data mutation so home-screen widgets
// update soon instead of waiting for Android's periodic update (minimum 30
// minutes). Updates are batched: several changes in a row (adding a
// transaction refreshes accounts, transactions and budgets) rebuild each
// widget once, after animations finish, so the app never stutters for
// them. No-ops on iOS/web — the library falls back to a stub there.
import { InteractionManager, Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderBothSchemes, type WidgetName } from './renderers';

const pending = new Set<WidgetName>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const names = [...pending];
  pending.clear();
  InteractionManager.runAfterInteractions(() => {
    for (const widgetName of names) {
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => renderBothSchemes(widgetName, { width: info.width, height: info.height }),
      }).catch(() => {});
    }
  });
}

export function refreshWidgets(names: WidgetName[], delayMs = 1500) {
  if (Platform.OS !== 'android') return;
  for (const n of names) pending.add(n);
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, delayMs);
}

// Right away, for when timers may not get to run: the background widget task
// and the moment the app is sent to the background.
export async function refreshWidgetsNow(names: WidgetName[]) {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    names.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => renderBothSchemes(widgetName, { width: info.width, height: info.height }),
      }).catch(() => {})
    )
  );
}

// Each kind of change also refreshes the Smart Stack, which shows a bit of
// everything.
export const refreshPrayerWidget = () => refreshWidgets(['PrayerWidget', 'SmartWidget']);
export const refreshTasksWidget = () => refreshWidgets(['TasksWidget', 'SmartWidget']);
export const refreshMoneyWidget = () => refreshWidgets(['MoneyWidget', 'SpendWidget', 'SmartWidget']);
export const refreshLifeWidget = () => refreshWidgets(['LifeWidget', 'SmartWidget']);
