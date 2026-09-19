import * as repo from "../db/repo.js";
import type {
  CheckIn,
  Habit,
  Identity,
  ScorecardEntry,
  ScorecardRating,
} from "../domain/types.js";
import type { NewHabitInput } from "../db/repo.js";

export interface AppState {
  identities: Identity[];
  habits: Habit[];
  checkins: CheckIn[];
  scorecard: ScorecardEntry[];
  loaded: boolean;
}

const state: AppState = {
  identities: [],
  habits: [],
  checkins: [],
  scorecard: [],
  loaded: false,
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function getState(): Readonly<AppState> {
  return state;
}

export async function loadAll(): Promise<void> {
  const [identities, habits, checkins, scorecard] = await Promise.all([
    repo.listIdentities(),
    repo.listHabits(),
    repo.listCheckIns(),
    repo.listScorecard(),
  ]);
  state.identities = identities;
  state.habits = habits;
  state.checkins = checkins;
  state.scorecard = scorecard;
  state.loaded = true;
  notify();
}

// ---- Identities ----

export async function addIdentity(statement: string): Promise<void> {
  const identity = await repo.createIdentity(statement);
  state.identities = [...state.identities, identity];
  notify();
}

export async function archiveIdentity(id: string): Promise<void> {
  await repo.archiveIdentity(id);
  state.identities = state.identities.map((i) =>
    i.id === id ? { ...i, archived: true } : i
  );
  notify();
}

export async function updateIdentity(identity: Identity): Promise<void> {
  await repo.updateIdentity(identity);
  state.identities = state.identities.map((i) => (i.id === identity.id ? identity : i));
  notify();
}

// ---- Habits ----

export async function addHabit(input: NewHabitInput): Promise<void> {
  const habit = await repo.createHabit(input);
  state.habits = [...state.habits, habit];
  notify();
}

export async function saveHabit(habit: Habit): Promise<void> {
  await repo.updateHabit(habit);
  state.habits = state.habits.map((h) => (h.id === habit.id ? habit : h));
  notify();
}

export async function archiveHabit(id: string): Promise<void> {
  await repo.archiveHabit(id);
  state.habits = state.habits.map((h) =>
    h.id === id ? { ...h, archived: true } : h
  );
  notify();
}

// ---- Check-ins ----

export type CheckInMode = "full" | "two-minute" | "clear";

export async function setCheckIn(
  habitId: string,
  date: string,
  mode: CheckInMode
): Promise<void> {
  const patch =
    mode === "clear"
      ? null
      : mode === "full"
      ? { completedFull: true, usedTwoMinuteVersion: false }
      : { completedFull: false, usedTwoMinuteVersion: true };

  await repo.setCheckIn(habitId, date, state.checkins, patch);
  state.checkins = await repo.listCheckIns();
  notify();
}

// ---- Scorecard ----

export async function addScorecardEntry(
  activity: string,
  rating: ScorecardRating,
  note = ""
): Promise<void> {
  const entry = await repo.addScorecardEntry(activity, rating, note);
  state.scorecard = [...state.scorecard, entry];
  notify();
}

export async function removeScorecardEntry(id: string): Promise<void> {
  await repo.removeScorecardEntry(id);
  state.scorecard = state.scorecard.filter((e) => e.id !== id);
  notify();
}

// ---- Backup / restore ----

export const exportAllData = repo.exportAllData;
export const isValidBackup = repo.isValidBackup;

export async function restoreFromBackup(backup: repo.BackupFile): Promise<void> {
  await repo.restoreFromBackup(backup);
  await loadAll();
}

export async function resetAllData(): Promise<void> {
  await repo.resetAllData();
  await loadAll();
}
