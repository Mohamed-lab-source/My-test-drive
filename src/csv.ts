import type { Habit, CheckIn } from "./domain/types.js";
import type { CheckInMode } from "./state/store.js";

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

// ---- Import ----

/**
 * Minimal RFC4180-ish single-line CSV field splitter — handles quoted
 * fields (with "" as an escaped quote) since a habit name could contain a
 * comma. Doesn't handle a quoted field spanning multiple physical lines,
 * which this app's own export never produces.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CsvImportRow {
  habitId: string;
  date: string;
  mode: Extract<CheckInMode, "full" | "two-minute">;
}

export interface CsvImportPreview {
  toApply: CsvImportRow[];
  /** Habit names in the CSV that don't match any current habit, by name. */
  unmatchedNames: string[];
  /** Rows that were structurally malformed (missing field, bad date/status). */
  invalidRowCount: number;
  totalDataRows: number;
}

/** Parses check-in rows from CSV text (matching checkinsToCsv's format) against known habits, without applying anything. */
export function previewCsvImport(habits: Habit[], csvText: string): CsvImportPreview {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const dataLines = lines.length > 0 && lines[0]!.toLowerCase().startsWith("habit,date,status") ? lines.slice(1) : lines;

  const habitByName = new Map(habits.map((h) => [h.name.trim().toLowerCase(), h]));
  const toApply: CsvImportRow[] = [];
  const unmatchedNames = new Set<string>();
  let invalidRowCount = 0;

  for (const line of dataLines) {
    const [habitNameRaw, date, status] = parseCsvLine(line);
    const habitName = habitNameRaw?.trim();
    if (!habitName || !date || !DATE_RE.test(date) || (status !== "full" && status !== "two-minute")) {
      invalidRowCount++;
      continue;
    }
    const habit = habitByName.get(habitName.toLowerCase());
    if (!habit) {
      unmatchedNames.add(habitName);
      continue;
    }
    toApply.push({ habitId: habit.id, date, mode: status });
  }

  return {
    toApply,
    unmatchedNames: Array.from(unmatchedNames),
    invalidRowCount,
    totalDataRows: dataLines.length,
  };
}
