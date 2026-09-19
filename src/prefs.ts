// Local-only user preferences, persisted to localStorage. No store/IndexedDB
// involvement since these are device-level UI settings, not app data.

export type Theme = "system" | "light" | "dark";

export interface Prefs {
  sound: boolean;
  haptics: boolean;
  theme: Theme;
}

const KEY = "atomic-prefs";

const DEFAULTS: Prefs = { sound: true, haptics: true, theme: "system" };

let cached: Prefs | null = null;

export function getPrefs(): Prefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cached = { ...DEFAULTS, ...parsed };
      return cached!;
    }
  } catch {
    // localStorage unavailable or corrupt — fall back to defaults
  }
  cached = { ...DEFAULTS };
  return cached;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  const next = { ...getPrefs(), [key]: value };
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore — pref just won't persist across sessions
  }
  if (key === "theme") applyTheme();
}

/** Reflects the theme preference onto <html data-theme>, read by CSS overrides. */
export function applyTheme(): void {
  const theme = getPrefs().theme;
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

let audioCtx: AudioContext | null = null;

/** A short, pleasant two-note chime synthesized with Web Audio — no asset files. */
export function playChime(): void {
  if (!getPrefs().sound) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = [880, 1318.5]; // A5 -> E6
    notes.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  } catch {
    // Web Audio unsupported or blocked — silently skip
  }
}
