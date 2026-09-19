// Local-only user preferences, persisted to localStorage. No store/IndexedDB
// involvement since these are device-level UI settings, not app data.
const KEY = "atomic-prefs";
const DEFAULTS = { sound: true, haptics: true };
let cached = null;
export function getPrefs() {
    if (cached)
        return cached;
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            cached = { ...DEFAULTS, ...parsed };
            return cached;
        }
    }
    catch {
        // localStorage unavailable or corrupt — fall back to defaults
    }
    cached = { ...DEFAULTS };
    return cached;
}
export function setPref(key, value) {
    const next = { ...getPrefs(), [key]: value };
    cached = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    }
    catch {
        // ignore — pref just won't persist across sessions
    }
}
let audioCtx = null;
/** A short, pleasant two-note chime synthesized with Web Audio — no asset files. */
export function playChime() {
    if (!getPrefs().sound)
        return;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx)
            return;
        if (!audioCtx)
            audioCtx = new Ctx();
        if (audioCtx.state === "suspended")
            audioCtx.resume();
        const now = audioCtx.currentTime;
        const notes = [880, 1318.5]; // A5 -> E6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const start = now + i * 0.09;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.34);
        });
    }
    catch {
        // Web Audio unsupported or blocked — silently skip
    }
}
//# sourceMappingURL=prefs.js.map