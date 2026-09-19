import type { CheckIn, Habit } from "./domain/types.js";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** habit name, date, status — sorted by date then habit name. */
export function checkinsToCsv(habits: Habit[], checkins: CheckIn[]): string {
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const rows = checkins
    .filter((c) => c.completedFull || c.usedTwoMinuteVersion)
    .map((c) => ({
      habitName: habitById.get(c.habitId)?.name ?? "(deleted habit)",
      date: c.date,
      status: c.completedFull ? "full" : "two-minute",
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.habitName.localeCompare(b.habitName));

  const header = "habit,date,status";
  const lines = rows.map((r) => [csvField(r.habitName), r.date, r.status].join(","));
  return [header, ...lines].join("\n");
}
