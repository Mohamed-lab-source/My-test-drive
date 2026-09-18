import { getAll, put, remove } from "./idb.js";
import { newId } from "../utils/id.js";
import type {
  CheckIn,
  Frequency,
  Habit,
  Identity,
  ScorecardEntry,
  ScorecardRating,
  StackAnchor,
} from "../domain/types.js";

// ---- Identities ----

export async function listIdentities(): Promise<Identity[]> {
  return getAll<Identity>("identities");
}

export async function createIdentity(statement: string): Promise<Identity> {
  const identity: Identity = {
    id: newId(),
    statement: statement.trim(),
    createdAt: new Date().toISOString(),
    archived: false,
  };
  await put("identities", identity);
  return identity;
}

export async function archiveIdentity(id: string): Promise<void> {
  const all = await listIdentities();
  const found = all.find((i) => i.id === id);
  if (!found) return;
  await put("identities", { ...found, archived: true });
}

// ---- Habits ----

export async function listHabits(): Promise<Habit[]> {
  return getAll<Habit>("habits");
}

export interface NewHabitInput {
  name: string;
  icon: string;
  identityId: string | null;
  frequency: Frequency;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  twoMinuteVersion: string;
  stackAnchor: StackAnchor;
}

export async function createHabit(input: NewHabitInput): Promise<Habit> {
  const habit: Habit = {
    id: newId(),
    createdAt: new Date().toISOString(),
    archived: false,
    ...input,
  };
  await put("habits", habit);
  return habit;
}

export async function updateHabit(habit: Habit): Promise<void> {
  await put("habits", habit);
}

export async function archiveHabit(id: string): Promise<void> {
  const all = await listHabits();
  const found = all.find((h) => h.id === id);
  if (!found) return;
  await put("habits", { ...found, archived: true });
}

// ---- Check-ins ----

export async function listCheckIns(): Promise<CheckIn[]> {
  return getAll<CheckIn>("checkins");
}

/** Sets (or clears) the check-in for a habit on a given date. */
export async function setCheckIn(
  habitId: string,
  date: string,
  existing: CheckIn[],
  patch: { completedFull?: boolean; usedTwoMinuteVersion?: boolean } | null
): Promise<void> {
  const current = existing.find((c) => c.habitId === habitId && c.date === date);

  if (patch === null) {
    if (current) await remove("checkins", current.id);
    return;
  }

  const next: CheckIn = current
    ? { ...current, ...patch }
    : {
        id: newId(),
        habitId,
        date,
        completedFull: false,
        usedTwoMinuteVersion: false,
        createdAt: new Date().toISOString(),
        ...patch,
      };
  await put("checkins", next);
}

// ---- Scorecard ----

export async function listScorecard(): Promise<ScorecardEntry[]> {
  return getAll<ScorecardEntry>("scorecard");
}

export async function addScorecardEntry(
  activity: string,
  rating: ScorecardRating,
  note = ""
): Promise<ScorecardEntry> {
  const entry: ScorecardEntry = {
    id: newId(),
    activity: activity.trim(),
    rating,
    note: note.trim(),
    createdAt: new Date().toISOString(),
  };
  await put("scorecard", entry);
  return entry;
}

export async function removeScorecardEntry(id: string): Promise<void> {
  await remove("scorecard", id);
}
