import { getAll, put, remove, clearStore, putAll, STORES } from "./idb.js";
import { newId } from "../utils/id.js";
// ---- Identities ----
export async function listIdentities() {
    return getAll("identities");
}
export async function createIdentity(statement) {
    const identity = {
        id: newId(),
        statement: statement.trim(),
        createdAt: new Date().toISOString(),
        archived: false,
    };
    await put("identities", identity);
    return identity;
}
export async function archiveIdentity(id) {
    const all = await listIdentities();
    const found = all.find((i) => i.id === id);
    if (!found)
        return;
    await put("identities", { ...found, archived: true });
}
export async function updateIdentity(identity) {
    await put("identities", identity);
}
// ---- Habits ----
export async function listHabits() {
    const habits = await getAll("habits");
    // Backfill fields added after some habits were created.
    return habits.map((h) => ({ ...h, timeOfDay: h.timeOfDay ?? "anytime" }));
}
export async function createHabit(input) {
    const habit = {
        id: newId(),
        createdAt: new Date().toISOString(),
        archived: false,
        ...input,
    };
    await put("habits", habit);
    return habit;
}
export async function updateHabit(habit) {
    await put("habits", habit);
}
export async function archiveHabit(id) {
    const all = await listHabits();
    const found = all.find((h) => h.id === id);
    if (!found)
        return;
    await put("habits", { ...found, archived: true });
}
// ---- Check-ins ----
export async function listCheckIns() {
    return getAll("checkins");
}
/** Sets (or clears) the check-in for a habit on a given date. */
export async function setCheckIn(habitId, date, existing, patch) {
    const current = existing.find((c) => c.habitId === habitId && c.date === date);
    if (patch === null) {
        if (current)
            await remove("checkins", current.id);
        return;
    }
    const next = current
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
export async function listScorecard() {
    return getAll("scorecard");
}
export async function addScorecardEntry(activity, rating, note = "") {
    const entry = {
        id: newId(),
        activity: activity.trim(),
        rating,
        note: note.trim(),
        createdAt: new Date().toISOString(),
    };
    await put("scorecard", entry);
    return entry;
}
export async function removeScorecardEntry(id) {
    await remove("scorecard", id);
}
export async function exportAllData() {
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
export function isValidBackup(value) {
    if (!value || typeof value !== "object")
        return false;
    const v = value;
    if (v["app"] !== "atomic-habits" || typeof v["data"] !== "object" || v["data"] === null)
        return false;
    const data = v["data"];
    return STORES.every((store) => Array.isArray(data[store]));
}
/** Replaces all local data with the contents of a backup. */
export async function restoreFromBackup(backup) {
    await Promise.all(STORES.map((store) => clearStore(store)));
    await Promise.all([
        putAll("identities", backup.data.identities),
        putAll("habits", backup.data.habits),
        putAll("checkins", backup.data.checkins),
        putAll("scorecard", backup.data.scorecard),
    ]);
}
export async function resetAllData() {
    await Promise.all(STORES.map((store) => clearStore(store)));
}
//# sourceMappingURL=repo.js.map