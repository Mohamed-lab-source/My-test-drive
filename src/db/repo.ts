import { getAll, put, remove, clearStore, putAll, STORES } from "./idb.js";
import { newId } from "../utils/id.js";
import type {
  CheckIn,
  Frequency,
  Habit,
  Identity,
  ScorecardEntry,
  ScorecardRating,
  StackAnchor,
  TimeOfDay,
} from "../domain/types.js";

// ---- Identities ----

export async function listIdentities(): Promise<Identity[]> {
  const identities = await getAll<Identity>("identities");
  return identities.map((i) => ({ ...i, why: i.why ?? "" }));
}

export async function createIdentity(statement: string): Promise<Identity> {
  const identity: Identity = {
    id: newId(),
    statement: statement.trim(),
    why: "",
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

export async function updateIdentity(identity: Identity): Promise<void> {
  await put("identities", identity);
}

// ---- Habits ----

export async function listHabits(): Promise<Habit[]> {
  const habits = await getAll<Habit>("habits");
  // Backfill fields added after some habits were created. sortOrder falls
  // back to creation time so pre-existing habits keep their original order.
  return habits.map((h) => ({
    ...h,
    timeOfDay: h.timeOfDay ?? ("anytime" as TimeOfDay),
    sortOrder: h.sortOrder ?? Date.parse(h.createdAt),
    tags: h.tags ?? [],
  }));
}

export interface NewHabitInput {
  name: string;
  icon: string;
  identityId: string | null;
  frequency: Frequency;
  timeOfDay: TimeOfDay;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  twoMinuteVersion: string;
  stackAnchor: StackAnchor;
  tags: string[];
}

export async function createHabit(input: NewHabitInput): Promise<Habit> {
  const habit: Habit = {
    id: newId(),
    sortOrder: Date.now(),
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
  const checkins = await getAll<CheckIn>("checkins");
  // Backfill fields added after some check-ins were created.
  return checkins.map((c) => ({ ...c, skipped: c.skipped ?? false, frozen: c.frozen ?? false, note: c.note ?? "" }));
}

/** Sets (or clears) the check-in for a habit on a given date. */
export async function setCheckIn(
  habitId: string,
  date: string,
  existing: CheckIn[],
  patch: {
    completedFull?: boolean;
    usedTwoMinuteVersion?: boolean;
    skipped?: boolean;
    frozen?: boolean;
    note?: string;
  } | null
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
        skipped: false,
        frozen: false,
        note: "",
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

// ---- Backup / restore ----

export interface BackupFile {
  app: "atomic-habits";
  version: 1;
  exportedAt: string;
  data: {
    identities: Identity[];
    habits: Habit[];
    checkins: CheckIn[];
    scorecard: ScorecardEntry[];
  };
}

export async function exportAllData(): Promise<BackupFile> {
  const [identities, habits, checkins, scorecard] = await Promise.all([
    listIdentities(),
    listHabits(),
    listCheckIns(),
    listScorecard(),
  ]);
  return {
    app: "atomic-habits",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { identities, habits, checkins, scorecard },
  };
}

export function isValidBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v["app"] !== "atomic-habits" || typeof v["data"] !== "object" || v["data"] === null) return false;
  const data = v["data"] as Record<string, unknown>;
  return STORES.every((store) => Array.isArray(data[store]));
}

/** Replaces all local data with the contents of a backup. */
export async function restoreFromBackup(backup: BackupFile): Promise<void> {
  await Promise.all(STORES.map((store) => clearStore(store)));
  await Promise.all([
    putAll("identities", backup.data.identities),
    putAll("habits", backup.data.habits),
    putAll("checkins", backup.data.checkins),
    putAll("scorecard", backup.data.scorecard),
  ]);
}

export async function resetAllData(): Promise<void> {
  await Promise.all(STORES.map((store) => clearStore(store)));
}
