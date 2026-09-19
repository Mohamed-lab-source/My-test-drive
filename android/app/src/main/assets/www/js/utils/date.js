function pad(n) {
    return n < 10 ? `0${n}` : `${n}`;
}
export function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO() {
    return toISODate(new Date());
}
export function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}
export function addDays(iso, delta) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + delta);
    return toISODate(d);
}
export function weekdayOf(iso) {
    return parseISODate(iso).getDay();
}
export function isDue(frequency, iso) {
    if (frequency.type === "daily")
        return true;
    return frequency.days.includes(weekdayOf(iso));
}
/** Last n dates ending today (inclusive), oldest first. */
export function lastNDates(n, endingIso = todayISO()) {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
        dates.push(addDays(endingIso, -i));
    }
    return dates;
}
export function startOfMonth(iso) {
    const d = parseISODate(iso);
    return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}
/** Adds whole calendar months, clamping the day if the target month is shorter. */
export function addMonths(iso, delta) {
    const d = parseISODate(iso);
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
    const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, daysInTarget));
    return toISODate(target);
}
/** All dates from startIso to endIso, inclusive, oldest first. */
export function datesInRange(startIso, endIso) {
    const dates = [];
    let cursor = startIso;
    while (cursor <= endIso) {
        dates.push(cursor);
        cursor = addDays(cursor, 1);
    }
    return dates;
}
export function formatDisplay(iso) {
    const d = parseISODate(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//# sourceMappingURL=date.js.map