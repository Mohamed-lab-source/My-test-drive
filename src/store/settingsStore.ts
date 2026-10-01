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
  jumuahReminder: boolean;
  setJumuahReminder: (v: boolean) => void;
  gettingStartedDismissed: boolean;
  setGettingStartedDismissed: (v: boolean) => void;
  sunnahFastReminders: boolean;
  setSunnahFastReminders: (v: boolean) => void;
  morningBriefing: boolean;
  setMorningBriefing: (v: boolean) => void;
  eveningJournal: boolean;
  setEveningJournal: (v: boolean) => void;
  goldPricePerGram: number;
  setGoldPricePerGram: (v: number) => void;
  sadaqahGoal: number;
  setSadaqahGoal: (v: number) => void;
  waterGoal: number;
  setWaterGoal: (v: number) => void;
  waterReminders: boolean;
  setWaterReminders: (v: boolean) => void;
  hiddenHomeCards: string[];
  toggleHomeCard: (id: string) => void;
  smsImportEnabled: boolean;
  setSmsImportEnabled: (v: boolean) => void;
  smsSenders: string[];
  setSmsSenders: (v: string[]) => void;
  smsLastScan: number;
  setSmsLastScan: (v: number) => void;
  smsAccountId: string | null;
  setSmsAccountId: (id: string | null) => void;
  smsInstantAlerts: boolean;
  setSmsInstantAlerts: (v: boolean) => void;
  smsAutoAddKnown: boolean;
  setSmsAutoAddKnown: (v: boolean) => void;
  smsReadCredits: boolean;
  setSmsReadCredits: (v: boolean) => void;
  netWorthGoal: number;
  setNetWorthGoal: (v: number) => void;
  quranDailyGoal: number;
  setQuranDailyGoal: (v: number) => void;
  weightGoal: number;
  setWeightGoal: (v: number) => void;
  bedtime: string | null;
  setBedtime: (v: string | null) => void;
  topTask: { id: string; date: string } | null;
  setTopTask: (v: { id: string; date: string } | null) => void;
  lockTimeoutMinutes: number;
  setLockTimeoutMinutes: (v: number) => void;
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
      jumuahReminder: false,
      setJumuahReminder: (v) => set({ jumuahReminder: v }),
      gettingStartedDismissed: false,
      setGettingStartedDismissed: (v) => set({ gettingStartedDismissed: v }),
      sunnahFastReminders: false,
      setSunnahFastReminders: (v) => set({ sunnahFastReminders: v }),
      morningBriefing: false,
      setMorningBriefing: (v) => set({ morningBriefing: v }),
      eveningJournal: false,
      setEveningJournal: (v) => set({ eveningJournal: v }),
      goldPricePerGram: 0,
      setGoldPricePerGram: (v) => set({ goldPricePerGram: v }),
      sadaqahGoal: 0,
      setSadaqahGoal: (v) => set({ sadaqahGoal: v }),
      waterGoal: 8,
      setWaterGoal: (v) => set({ waterGoal: v }),
      waterReminders: false,
      setWaterReminders: (v) => set({ waterReminders: v }),
      hiddenHomeCards: [],
      toggleHomeCard: (id) =>
        set((s) => ({
          hiddenHomeCards: s.hiddenHomeCards.includes(id) ? s.hiddenHomeCards.filter((c) => c !== id) : [...s.hiddenHomeCards, id],
        })),
      smsImportEnabled: false,
      setSmsImportEnabled: (v) => set({ smsImportEnabled: v }),
      smsSenders: ['HSBC'],
      setSmsSenders: (v) => set({ smsSenders: v }),
      smsLastScan: 0,
      setSmsLastScan: (v) => set({ smsLastScan: v }),
      smsAccountId: null,
      setSmsAccountId: (id) => set({ smsAccountId: id }),
      smsInstantAlerts: true,
      setSmsInstantAlerts: (v) => set({ smsInstantAlerts: v }),
      smsAutoAddKnown: false,
      setSmsAutoAddKnown: (v) => set({ smsAutoAddKnown: v }),
      smsReadCredits: false,
      setSmsReadCredits: (v) => set({ smsReadCredits: v }),
      netWorthGoal: 0,
      setNetWorthGoal: (v) => set({ netWorthGoal: v }),
      quranDailyGoal: 0,
      setQuranDailyGoal: (v) => set({ quranDailyGoal: v }),
      weightGoal: 0,
      setWeightGoal: (v) => set({ weightGoal: v }),
      bedtime: null,
      setBedtime: (v) => set({ bedtime: v }),
      topTask: null,
      setTopTask: (v) => set({ topTask: v }),
      lockTimeoutMinutes: 0,
      setLockTimeoutMinutes: (v) => set({ lockTimeoutMinutes: v }),
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
