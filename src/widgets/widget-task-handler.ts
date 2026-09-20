import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { todayKey } from '../db/client';
import * as lifeRepo from '../db/repositories/life';
import type { Prayer } from '../db/types';
import { renderBothSchemes } from './renderers';

// Runs as a headless JS task — the app may not be in the foreground (or
// running at all), so this never touches Zustand stores or React; it only
// talks to SQLite/AsyncStorage directly via `renderers`.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE_PRAYER') {
    const prayer = clickActionData?.prayer as Prayer | undefined;
    if (prayer) {
      const key = todayKey();
      const logs = await lifeRepo.listPrayerLogsForDate(key);
      const wasDone = logs.some((l) => l.prayer === prayer && l.completed === 1);
      await lifeRepo.setPrayerLog(key, prayer, !wasDone);
    }
  }

  renderWidget(await renderBothSchemes(widgetInfo.widgetName));
}
