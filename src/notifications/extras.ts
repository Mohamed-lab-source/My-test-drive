// Re-arms the reminders that depend on data from several stores. Lives apart
// from scheduler.ts so the stores (which import the scheduler) don't form an
// import cycle with it.
import { useHabitsStore } from '../store/habitsStore';
import { useProductivityStore } from '../store/productivityStore';
import { useFinanceStore } from '../store/financeStore';
import {
  rescheduleHabitReminders,
  rescheduleSunnahFastReminders,
  scheduleEveningJournal,
  scheduleMorningBriefing,
} from './scheduler';

export async function rescheduleExtraReminders(): Promise<void> {
  const { tasks, meetings } = useProductivityStore.getState();
  await rescheduleHabitReminders(useHabitsStore.getState().habits);
  await rescheduleSunnahFastReminders();
  await scheduleMorningBriefing({ tasks, meetings, rules: useFinanceStore.getState().recurringRules });
  await scheduleEveningJournal();
}
