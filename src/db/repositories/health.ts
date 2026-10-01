import { deleteRow, getRow, insertRow, updateRow, whereRows } from '../helpers';
import type { SleepLog, SunnahPrayerKind, SunnahPrayerLog, WaterLog, WeightLog } from '../types';

type DayTable = 'water_logs' | 'sleep_logs' | 'weight_logs';

// Insert-or-update for tables keyed by the date itself.
async function setDayValue(table: DayTable, date: string, fields: Record<string, number>): Promise<void> {
  if (await getRow(table, date)) await updateRow(table, date, fields);
  else await insertRow(table, { id: date, ...fields });
}

const since = <T>(table: DayTable, sinceKey: string) => whereRows<T>(table, 'id >= ?', [sinceKey], 'id ASC');

// ---------- Water ----------
export async function getWater(date: string): Promise<number> {
  return (await getRow<WaterLog>('water_logs', date))?.count ?? 0;
}
export const setWater = (date: string, count: number) => setDayValue('water_logs', date, { count: Math.max(0, count) });
export const listWaterSince = (sinceKey: string) => since<WaterLog>('water_logs', sinceKey);

// ---------- Sleep ----------
export const setSleep = (date: string, hours: number) => setDayValue('sleep_logs', date, { hours });
export const listSleepSince = (sinceKey: string) => since<SleepLog>('sleep_logs', sinceKey);

// ---------- Weight ----------
export const setWeight = (date: string, kg: number) => setDayValue('weight_logs', date, { kg });
export const deleteWeight = (date: string) => deleteRow('weight_logs', date);
export const listWeightSince = (sinceKey: string) => since<WeightLog>('weight_logs', sinceKey);

// ---------- Sunnah prayers ----------
export const listSunnahPrayersSince = (sinceKey: string) =>
  whereRows<SunnahPrayerLog>('sunnah_prayer_logs', 'date >= ?', [sinceKey], 'date ASC');

export async function setSunnahPrayer(date: string, kind: SunnahPrayerKind, done: boolean): Promise<void> {
  const id = `${date}-${kind}`;
  const exists = !!(await getRow('sunnah_prayer_logs', id));
  if (done && !exists) await insertRow('sunnah_prayer_logs', { id, date, kind });
  if (!done && exists) await deleteRow('sunnah_prayer_logs', id);
}
