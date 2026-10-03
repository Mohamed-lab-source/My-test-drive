// Called from the running app after a data mutation so home-screen widgets
// update immediately instead of waiting for Android's periodic update
// (minimum 30 minutes). No-ops on iOS/web — the library falls back to a
// stub native module there, so no Platform check is needed here.
import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderBothSchemes, type WidgetName } from './renderers';

function refresh(widgetName: WidgetName) {
  requestWidgetUpdate({
    widgetName,
    renderWidget: () => renderBothSchemes(widgetName),
  }).catch(() => {});
}

export const refreshPrayerWidget = () => refresh('PrayerWidget');
export const refreshTasksWidget = () => refresh('TasksWidget');
export const refreshMoneyWidget = () => refresh('MoneyWidget');
