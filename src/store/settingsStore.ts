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
