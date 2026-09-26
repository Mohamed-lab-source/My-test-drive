// Local reminder notifications — deliberately scoped: the Notification API
// only works while this page/tab is actually open (no service-worker push
// subscription or native Android scheduling is wired up), so this is a
// best-effort nudge for whenever the app happens to be open around the
// reminder time, not a guaranteed daily alarm. That limitation is called
// out in the Settings UI text too, not just here.
import { getState } from "./state/store.js";
import { getPrefs } from "./prefs.js";
import { todayISO, isDue } from "./utils/date.js";
import { findCheckIn, isVote, isNeutralized } from "./domain/analytics.js";
export function isNotificationSupported() {
    return "Notification" in window;
}
export function getNotificationPermission() {
    if (!isNotificationSupported())
        return "unsupported";
    return Notification.permission;
}
export async function requestNotificationPermission() {
    if (!isNotificationSupported())
        return "denied";
    return Notification.requestPermission();
}
function countIncompleteDueHabits() {
    const { habits, checkins } = getState();
    const today = todayISO();
    const due = habits.filter((h) => !h.archived && isDue(h.frequency, today));
    return due.filter((h) => {
        const checkin = findCheckIn(checkins, h.id, today);
        return !isVote(checkin) && !isNeutralized(checkin);
    }).length;
}
function showReminderNotification() {
    const count = countIncompleteDueHabits();
    if (count === 0)
        return; // nothing left to nudge about today
    try {
        const notification = new Notification("Atomic", {
            body: `${count} habit${count === 1 ? "" : "s"} still due today. Every vote counts.`,
            icon: "icons/icon.svg",
            tag: "atomic-daily-reminder",
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
    catch {
        // Notification construction can throw in some contexts (e.g. inside a
        // WebView without full support) — fail silently, nothing to recover.
    }
}
let reminderTimer = null;
/** Computes the next occurrence (today if still ahead, else tomorrow) of "HH:MM" local time. */
function nextOccurrence(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date();
    next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    if (next.getTime() <= Date.now())
        next.setDate(next.getDate() + 1);
    return next;
}
/**
 * (Re)arms the reminder timer from the current preference. Call this on
 * startup and again any time the reminder time preference changes.
 */
export function scheduleReminderCheck() {
    if (reminderTimer) {
        clearTimeout(reminderTimer);
        reminderTimer = null;
    }
    const { reminderTime } = getPrefs();
    if (!reminderTime || getNotificationPermission() !== "granted")
        return;
    const fireAt = nextOccurrence(reminderTime);
    const delay = Math.max(0, fireAt.getTime() - Date.now());
    reminderTimer = setTimeout(() => {
        showReminderNotification();
        scheduleReminderCheck(); // re-arm for the next day
    }, delay);
}
//# sourceMappingURL=reminders.js.map