import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Appearance = 'system' | 'light' | 'dark';

interface SettingsState {
  appearance: Appearance;
  currency: string;
  hasOnboarded: boolean;
  defaultAccountId: string | null;
  notificationsEnabled: boolean;
  zakatNisab: number;
  setZakatNisab: (v: number) => void;
  prayerCityId: string | null;
  setPrayerCityId: (id: string | null) => void;
  prayerAlerts: boolean;
  setPrayerAlerts: (v: boolean) => void;
  hijriOffset: number;
  setHijriOffset: (v: number) => void;
  setAppearance: (a: Appearance) => void;
  setCurrency: (c: string) => void;
  setHasOnboarded: (v: boolean) => void;
  setDefaultAccountId: (id: string | null) => void;
  setNotificationsEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      currency: 'USD',
      hasOnboarded: false,
      defaultAccountId: null,
      notificationsEnabled: false,
      zakatNisab: 0,
      setZakatNisab: (v) => set({ zakatNisab: v }),
      prayerCityId: null,
      setPrayerCityId: (id) => set({ prayerCityId: id }),
      prayerAlerts: false,
      setPrayerAlerts: (v) => set({ prayerAlerts: v }),
      hijriOffset: 0,
      setHijriOffset: (v) => set({ hijriOffset: v }),
      setAppearance: (a) => set({ appearance: a }),
      setCurrency: (c) => set({ currency: c }),
      setHasOnboarded: (v) => set({ hasOnboarded: v }),
      setDefaultAccountId: (id) => set({ defaultAccountId: id }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
    }),
    {
      name: 'anchor-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Settings are restored from AsyncStorage asynchronously; anything that reads
// them at launch (reminder scheduling, prayer alerts) should await this first.
export function settingsHydrated(): Promise<void> {
  return new Promise((resolve) => {
    if (useSettingsStore.persist.hasHydrated()) return resolve();
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
