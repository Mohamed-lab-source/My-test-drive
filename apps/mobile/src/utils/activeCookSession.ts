import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.activeCookSession";

export type ActiveCookSession = {
  slug: string;
  title: string;
  cuisineSlug: string;
  stepIndex: number;
  totalSteps: number;
  servings: number;
};

export function saveActiveCookSession(session: ActiveCookSession): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)).catch(() => {});
}

export function clearActiveCookSession(): void {
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export async function getActiveCookSession(): Promise<ActiveCookSession | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ActiveCookSession) : null;
  } catch {
    return null;
  }
}
