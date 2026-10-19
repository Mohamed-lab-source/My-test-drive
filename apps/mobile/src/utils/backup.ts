import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "cookmate.";
const CACHE_PREFIXES = ["cookmate.recipeDetailCache.", "cookmate.recipeListCache.", "cookmate.homeCache"];
/**
 * Never in a backup: the sign-in token (a backup is plain text people share),
 * device-specific notification ids, and short-lived state like running timers.
 */
const EXCLUDED_KEYS = new Set([
  "cookmate.token",
  "cookmate.mealReminderIds",
  "cookmate.leftoverReminderIds",
  "cookmate.shoppingReminderId",
  "cookmate.activeCookSession",
  "cookmate.kitchenTimers",
]);
const BACKUP_FORMAT = "cookmate-backup";
const BACKUP_VERSION = 1;

type BackupFile = { format: string; version: number; exportedAt: string; data: Record<string, string> };

function isCacheKey(key: string): boolean {
  return CACHE_PREFIXES.some((p) => key.startsWith(p));
}

/** Everything the app stores on this phone (minus caches and secrets) as one JSON string. */
export async function createBackup(): Promise<{ json: string; keyCount: number }> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith(PREFIX) && !isCacheKey(k) && !EXCLUDED_KEYS.has(k)
  );
  const values = await AsyncStorage.getMany(keys);
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) if (value != null) data[key] = value;
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
  return { json: JSON.stringify(file), keyCount: Object.keys(data).length };
}

export type RestoreResult = { ok: true; keyCount: number } | { ok: false; reason: "invalid" | "empty" };

/** Validates a pasted backup and writes it back. Only cookmate.* keys are ever written. */
export async function restoreBackup(raw: string): Promise<RestoreResult> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (parsed?.format !== BACKUP_FORMAT || typeof parsed.data !== "object" || parsed.data === null) {
    return { ok: false, reason: "invalid" };
  }
  const entries = Object.entries(parsed.data).filter(
    ([k, v]) => typeof v === "string" && k.startsWith(PREFIX) && !EXCLUDED_KEYS.has(k) && !isCacheKey(k)
  ) as [string, string][];
  if (entries.length === 0) return { ok: false, reason: "empty" };
  await AsyncStorage.setMany(Object.fromEntries(entries));
  return { ok: true, keyCount: entries.length };
}

/** Removes offline copies of recipes and lists; returns how many entries and roughly how many KB were freed. */
export async function clearRecipeCache(): Promise<{ count: number; kb: number }> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isCacheKey);
  if (keys.length === 0) return { count: 0, kb: 0 };
  const values = await AsyncStorage.getMany(keys);
  const bytes = Object.values(values).reduce((sum, v) => sum + (v?.length ?? 0), 0);
  await AsyncStorage.removeMany(keys);
  return { count: keys.length, kb: Math.round(bytes / 1024) };
}
