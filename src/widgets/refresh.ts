// Called from the running app after a data mutation so home-screen widgets
// update immediately instead of waiting for Android's periodic update
// (minimum 30 minutes). No-ops on iOS/web — the library falls back to a
// stub native module there, so no Platform check is needed here.
import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderBothSchemes, type WidgetName } from './renderers';

export function refreshWidgets(names: WidgetName[]) {
  for (const widgetName of names) {
    requestWidgetUpdate({
      widgetName,
      renderWidget: (info) => renderBothSchemes(widgetName, { width: info.width, height: info.height }),
    }).catch(() => {});
  }
}

// Each kind of change also refreshes the Smart Stack, which shows a bit of
// everything.
export const refreshPrayerWidget = () => refreshWidgets(['PrayerWidget', 'SmartWidget']);
export const refreshTasksWidget = () => refreshWidgets(['TasksWidget', 'SmartWidget']);
export const refreshMoneyWidget = () => refreshWidgets(['MoneyWidget', 'SpendWidget', 'SmartWidget']);
export const refreshLifeWidget = () => refreshWidgets(['LifeWidget', 'SmartWidget']);
