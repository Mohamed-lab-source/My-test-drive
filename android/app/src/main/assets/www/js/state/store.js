import * as repo from "../db/repo.js";
const state = {
    identities: [],
    habits: [],
    checkins: [],
    scorecard: [],
    loaded: false,
};
const listeners = new Set();
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
// Every mutation below calls notify() on its own, which is exactly right for
// a single user action. But a caller that awaits several mutations in a loop
// (bulk-archiving N habits, importing N CSV rows) would otherwise trigger N
// full view re-renders in a row, when only the final state after the last
// one is ever actually seen. batch() lets such a caller coalesce those into
// one notify() at the end, without every individual mutation needing to know
// it might be running inside a batch.
let batchDepth = 0;
let notifyPending = false;
function notify() {
    if (batchDepth > 0) {
        notifyPending = true;
        return;
    }
    for (const fn of listeners)
        fn();
}
export async function batch(fn) {
    batchDepth++;
    try {
        await fn();
    }
    finally {
        batchDepth--;
        if (batchDepth === 0 && notifyPending) {
            notifyPending = false;
            for (const fn of listeners)
                fn();
        }
    }
}
export function getState() {
    return state;
}
export async function loadAll() {
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
export async function addIdentity(statement) {
    const identity = await repo.createIdentity(statement);
    state.identities = [...state.identities, identity];
    notify();
}
export async function archiveIdentity(id) {
    await repo.archiveIdentity(id);
    state.identities = state.identities.map((i) => i.id === id ? { ...i, archived: true } : i);
    notify();
}
export async function updateIdentity(identity) {
    await repo.updateIdentity(identity);
    state.identities = state.identities.map((i) => (i.id === identity.id ? identity : i));
    notify();
}
// ---- Habits ----
export async function addHabit(input) {
    const habit = await repo.createHabit(input);
    state.habits = [...state.habits, habit];
    notify();
}
export async function saveHabit(habit) {
    await repo.updateHabit(habit);
    state.habits = state.habits.map((h) => (h.id === habit.id ? habit : h));
    notify();
}
export async function archiveHabit(id) {
    await repo.archiveHabit(id);
    state.habits = state.habits.map((h) => h.id === id ? { ...h, archived: true } : h);
    notify();
}
export async function setCheckIn(habitId, date, mode) {
    const patch = mode === "clear"
        ? null
        : mode === "full"
            ? { completedFull: true, usedTwoMinuteVersion: false, skipped: false, frozen: false }
            : mode === "two-minute"
                ? { completedFull: false, usedTwoMinuteVersion: true, skipped: false, frozen: false }
                : mode === "skip"
                    ? { completedFull: false, usedTwoMinuteVersion: false, skipped: true, frozen: false }
                    : { completedFull: false, usedTwoMinuteVersion: false, skipped: false, frozen: true };
    await repo.setCheckIn(habitId, date, state.checkins, patch);
    state.checkins = await repo.listCheckIns();
    notify();
}
/** Upserts a journal note for a day without touching completion/skip state. */
export async function setCheckInNote(habitId, date, note) {
    await repo.setCheckIn(habitId, date, state.checkins, { note: note.trim() });
    state.checkins = await repo.listCheckIns();
    notify();
}
// ---- Scorecard ----
export async function addScorecardEntry(activity, rating, note = "") {
    const entry = await repo.addScorecardEntry(activity, rating, note);
    state.scorecard = [...state.scorecard, entry];
    notify();
}
export async function removeScorecardEntry(id) {
    await repo.removeScorecardEntry(id);
    state.scorecard = state.scorecard.filter((e) => e.id !== id);
    notify();
}
// ---- Backup / restore ----
export const exportAllData = repo.exportAllData;
export const isValidBackup = repo.isValidBackup;
export async function restoreFromBackup(backup) {
    await repo.restoreFromBackup(backup);
    await loadAll();
}
export async function resetAllData() {
    await repo.resetAllData();
    await loadAll();
}
//# sourceMappingURL=store.js.map