import { getDb, newId, nowIso } from '../client';
import { allRows, deleteRow, insertRow, updateRow, whereRows } from '../helpers';
import type { AtomicHabitRow, CheckInRow, IdentityRow, ScorecardEntryRow } from '../types';
import type { CheckIn, Frequency, Habit, Identity, ScorecardEntry, StackAnchor, TimeOfDay } from '../../domain/habits/types';

// ---------- row <-> domain mapping ----------

function identityFromRow(row: IdentityRow): Identity {
  return {
    id: row.id,
    statement: row.statement,
    why: row.why ?? '',
    createdAt: row.created_at,
    archived: row.is_archived === 1,
  };
}

function habitFromRow(row: AtomicHabitRow): Habit {
  const frequency: Frequency =
    row.frequency_type === 'weekdays'
      ? { type: 'weekdays', days: JSON.parse(row.frequency_days ?? '[]') }
      : { type: 'daily' };

  const stackAnchor: StackAnchor =
    row.stack_anchor_type === 'habit'
      ? { type: 'habit', habitId: row.stack_anchor_habit_id ?? '' }
      : row.stack_anchor_type === 'custom'
        ? { type: 'custom', text: row.stack_anchor_text ?? '' }
        : { type: 'none' };

  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    identityId: row.identity_id,
    frequency,
    timeOfDay: row.time_of_day as TimeOfDay,
    cue: row.cue,
    craving: row.craving,
    response: row.response,
    reward: row.reward,
    twoMinuteVersion: row.two_minute_version,
    stackAnchor,
    sortOrder: row.sort_order,
    tags: JSON.parse(row.tags || '[]'),
    createdAt: row.created_at,
    archived: row.is_archived === 1,
  };
}

function checkInFromRow(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    completedFull: row.completed_full === 1,
    usedTwoMinuteVersion: row.used_two_minute_version === 1,
    skipped: row.skipped === 1,
    frozen: row.frozen === 1,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

function scorecardFromRow(row: ScorecardEntryRow): ScorecardEntry {
  return {
    id: row.id,
    activity: row.activity,
    rating: row.rating,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

// ---------- Identities ----------

export async function listIdentities(): Promise<Identity[]> {
  const rows = await allRows<IdentityRow>('identities', 'created_at ASC');
  return rows.map(identityFromRow);
}

export async function createIdentity(statement: string, why: string): Promise<string> {
  const id = newId();
  await insertRow('identities', { id, statement, why: why || null, is_archived: 0, created_at: nowIso() });
  return id;
}

export const updateIdentity = (id: string, patch: { statement?: string; why?: string }) =>
  updateRow('identities', id, patch);
export const archiveIdentity = (id: string) => updateRow('identities', id, { is_archived: 1 });
export const deleteIdentity = (id: string) => deleteRow('identities', id);

// ---------- Habits ----------

export async function listHabits(): Promise<Habit[]> {
  const rows = await allRows<AtomicHabitRow>('atomic_habits', 'sort_order ASC, created_at ASC');
  return rows.map(habitFromRow);
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
  sortOrder: number;
}

export async function createHabit(input: NewHabitInput): Promise<string> {
  const id = newId();
  await insertRow('atomic_habits', {
    id,
    name: input.name,
    icon: input.icon,
    identity_id: input.identityId,
    frequency_type: input.frequency.type,
    frequency_days: input.frequency.type === 'weekdays' ? JSON.stringify(input.frequency.days) : null,
    time_of_day: input.timeOfDay,
    cue: input.cue,
    craving: input.craving,
    response: input.response,
    reward: input.reward,
    two_minute_version: input.twoMinuteVersion,
    stack_anchor_type: input.stackAnchor.type,
    stack_anchor_habit_id: input.stackAnchor.type === 'habit' ? input.stackAnchor.habitId : null,
    stack_anchor_text: input.stackAnchor.type === 'custom' ? input.stackAnchor.text : null,
    sort_order: input.sortOrder,
    tags: JSON.stringify(input.tags),
    is_archived: 0,
    created_at: nowIso(),
  });
  return id;
}

export async function updateHabit(id: string, patch: Partial<NewHabitInput>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.identityId !== undefined) row.identity_id = patch.identityId;
  if (patch.frequency !== undefined) {
    row.frequency_type = patch.frequency.type;
    row.frequency_days = patch.frequency.type === 'weekdays' ? JSON.stringify(patch.frequency.days) : null;
  }
  if (patch.timeOfDay !== undefined) row.time_of_day = patch.timeOfDay;
  if (patch.cue !== undefined) row.cue = patch.cue;
  if (patch.craving !== undefined) row.craving = patch.craving;
  if (patch.response !== undefined) row.response = patch.response;
  if (patch.reward !== undefined) row.reward = patch.reward;
  if (patch.twoMinuteVersion !== undefined) row.two_minute_version = patch.twoMinuteVersion;
  if (patch.stackAnchor !== undefined) {
    row.stack_anchor_type = patch.stackAnchor.type;
    row.stack_anchor_habit_id = patch.stackAnchor.type === 'habit' ? patch.stackAnchor.habitId : null;
    row.stack_anchor_text = patch.stackAnchor.type === 'custom' ? patch.stackAnchor.text : null;
  }
  if (patch.tags !== undefined) row.tags = JSON.stringify(patch.tags);
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  await updateRow('atomic_habits', id, row);
}

export const archiveHabit = (id: string) => updateRow('atomic_habits', id, { is_archived: 1 });
export const deleteHabit = (id: string) => deleteRow('atomic_habits', id);

// ---------- Check-ins ----------

export async function listCheckins(): Promise<CheckIn[]> {
  const rows = await allRows<CheckInRow>('checkins', 'date ASC');
  return rows.map(checkInFromRow);
}

export interface CheckInPatch {
  completedFull?: boolean;
  usedTwoMinuteVersion?: boolean;
  skipped?: boolean;
  frozen?: boolean;
  note?: string;
}

/** Upserts the check-in for a habit/date, merging over any existing row. */
export async function setCheckIn(habitId: string, date: string, patch: CheckInPatch): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<CheckInRow>('SELECT * FROM checkins WHERE habit_id = ? AND date = ?', [
    habitId,
    date,
  ]);

  const merged: CheckInPatch = {
    completedFull: patch.completedFull ?? (existing ? existing.completed_full === 1 : false),
    usedTwoMinuteVersion: patch.usedTwoMinuteVersion ?? (existing ? existing.used_two_minute_version === 1 : false),
    skipped: patch.skipped ?? (existing ? existing.skipped === 1 : false),
    frozen: patch.frozen ?? (existing ? existing.frozen === 1 : false),
    note: patch.note ?? existing?.note ?? '',
  };

  await db.runAsync(
    `INSERT INTO checkins (id, habit_id, date, completed_full, used_two_minute_version, skipped, frozen, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET
       completed_full = excluded.completed_full,
       used_two_minute_version = excluded.used_two_minute_version,
       skipped = excluded.skipped,
       frozen = excluded.frozen,
       note = excluded.note`,
    [
      newId(),
      habitId,
      date,
      merged.completedFull ? 1 : 0,
      merged.usedTwoMinuteVersion ? 1 : 0,
      merged.skipped ? 1 : 0,
      merged.frozen ? 1 : 0,
      merged.note || null,
      nowIso(),
    ]
  );
}

/** Clears a check-in back to "not done" for a habit/date (keeps the row for history simplicity, zeroes flags). */
export async function clearCheckIn(habitId: string, date: string): Promise<void> {
  await setCheckIn(habitId, date, {
    completedFull: false,
    usedTwoMinuteVersion: false,
    skipped: false,
    frozen: false,
  });
}

// ---------- Scorecard ----------

export async function listScorecardEntries(): Promise<ScorecardEntry[]> {
  const rows = await allRows<ScorecardEntryRow>('scorecard_entries', 'created_at DESC');
  return rows.map(scorecardFromRow);
}

export async function createScorecardEntry(activity: string, rating: '+' | '-' | '=', note: string): Promise<string> {
  const id = newId();
  await insertRow('scorecard_entries', { id, activity, rating, note: note || null, created_at: nowIso() });
  return id;
}

export const deleteScorecardEntry = (id: string) => deleteRow('scorecard_entries', id);
