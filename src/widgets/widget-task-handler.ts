import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { todayKey } from '../db/client';
import * as lifeRepo from '../db/repositories/life';
import * as productivityRepo from '../db/repositories/productivity';
import * as financeRepo from '../db/repositories/finance';
import * as habitsRepo from '../db/repositories/habits';
import * as healthRepo from '../db/repositories/health';
import type { Prayer } from '../db/types';
import { renderBothSchemes, type WidgetName } from './renderers';
import { refreshWidgetsNow } from './refresh';

// Which other widgets show the data each action changes.
const AFFECTS: Record<string, WidgetName[]> = {
  TOGGLE_PRAYER: ['PrayerWidget', 'SmartWidget'],
  TOGGLE_TASK: ['TasksWidget', 'SmartWidget'],
  PAY_BILL: ['MoneyWidget', 'SpendWidget', 'SmartWidget'],
  TOGGLE_HABIT: ['LifeWidget', 'SmartWidget'],
  WATER_ADD: ['LifeWidget', 'SmartWidget'],
};

// Runs as a headless JS task — the app may not be in the foreground (or
// running at all), so this never touches Zustand stores or React; it only
// talks to SQLite/AsyncStorage directly via `renderers`.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  if (widgetAction === 'WIDGET_CLICK' && clickAction) {
    const key = todayKey();
    if (clickAction === 'TOGGLE_PRAYER') {
      const prayer = clickActionData?.prayer as Prayer | undefined;
      if (prayer) {
        const logs = await lifeRepo.listPrayerLogsForDate(key);
        const wasDone = logs.some((l) => l.prayer === prayer && l.completed === 1);
        await lifeRepo.setPrayerLog(key, prayer, !wasDone);
      }
    } else if (clickAction === 'TOGGLE_TASK') {
      const taskId = clickActionData?.taskId as string | undefined;
      if (taskId) {
        await productivityRepo.toggleTaskDone(taskId, true);
      }
    } else if (clickAction === 'PAY_BILL') {
      const ruleId = clickActionData?.ruleId as string | undefined;
      if (ruleId) {
        const rule = await financeRepo.getRecurringRule(ruleId);
        if (rule) {
          await financeRepo.postRecurringRule(rule);
        }
      }
    } else if (clickAction === 'TOGGLE_HABIT') {
      const habitId = clickActionData?.habitId as string | undefined;
      if (habitId) {
        const logs = await habitsRepo.listHabitLogsForDate(key);
        const wasDone = logs.some((l) => l.habit_id === habitId && l.completed === 1);
        await habitsRepo.setHabitLog(habitId, key, !wasDone);
      }
    } else if (clickAction === 'WATER_ADD') {
      await healthRepo.setWater(key, (await healthRepo.getWater(key)) + 1);
    }
    const others = (AFFECTS[clickAction] ?? []).filter((n) => n !== widgetInfo.widgetName);
    if (others.length) await refreshWidgetsNow(others);
  }

  renderWidget(await renderBothSchemes(widgetInfo.widgetName, { width: widgetInfo.width, height: widgetInfo.height }));
}
