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
  scheduleWaterReminders,
  rescheduleMedicationReminders,
  scheduleBedtimeReminder,
  rescheduleIslamicReminders,
  scheduleQuranReminder,
  rescheduleCardDueReminders,
  scheduleSpendDigest,
  scheduleMonthlyRecap,
  rescheduleDeadlineReminders,
  scheduleTahajjudReminders,
  scheduleWeeklyReviewReminder,
} from './scheduler';
import { listMedications, medicationTimes } from '../db/repositories/health';

export async function rescheduleExtraReminders(): Promise<void> {
  const { tasks, meetings } = useProductivityStore.getState();
  await rescheduleHabitReminders(useHabitsStore.getState().habits);
  await rescheduleSunnahFastReminders();
  await scheduleMorningBriefing({ tasks, meetings, rules: useFinanceStore.getState().recurringRules });
  await scheduleEveningJournal();
  await scheduleWaterReminders();
  await rescheduleMedicationReminders(await listMedications(), medicationTimes);
  await scheduleBedtimeReminder();
  await rescheduleIslamicReminders();
  await scheduleQuranReminder();
  const { accounts, transactions } = useFinanceStore.getState();
  await rescheduleCardDueReminders(accounts);
  await scheduleSpendDigest(transactions, accounts);
  await scheduleMonthlyRecap();
  await rescheduleDeadlineReminders(tasks);
  await scheduleTahajjudReminders();
  await scheduleWeeklyReviewReminder();
}
