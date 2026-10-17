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
  roundUpSince: string | null;
  setRoundUpSince: (v: string | null) => void;
  hideBalances: boolean;
  setHideBalances: (v: boolean) => void;
  lowBalanceAlert: number;
  setLowBalanceAlert: (v: number) => void;
  occasionReminders: boolean;
  setOccasionReminders: (v: boolean) => void;
  monThuReminders: boolean;
  setMonThuReminders: (v: boolean) => void;
  zakatHawl: { month: number; day: number } | null;
  setZakatHawl: (v: { month: number; day: number } | null) => void;
  textScale: number;
  setTextScale: (v: number) => void;
  quranReminder: string | null;
  setQuranReminder: (v: string | null) => void;
  readingGoal: number;
  setReadingGoal: (v: number) => void;
  prayerAdjust: Record<string, number>;
  setPrayerAdjust: (v: Record<string, number>) => void;
  fridayChecklist: { date: string; done: string[] } | null;
  setFridayChecklist: (v: { date: string; done: string[] } | null) => void;
  recapDismissedMonth: string | null;
  setRecapDismissedMonth: (v: string | null) => void;
  favoriteDuas: string[];
  toggleFavoriteDua: (id: string) => void;
  missedPromptDate: string | null;
  setMissedPromptDate: (v: string | null) => void;
  cardDueReminders: boolean;
  setCardDueReminders: (v: boolean) => void;
  spendDigest: boolean;
  setSpendDigest: (v: boolean) => void;
  use24h: boolean;
  setUse24h: (v: boolean) => void;
  wholeMoney: boolean;
  setWholeMoney: (v: boolean) => void;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  fitr: { people: number; perPerson: number };
  setFitr: (v: { people: number; perPerson: number }) => void;
  weekendDays: number[];
  setWeekendDays: (v: number[]) => void;
  weekStart: number;
  setWeekStart: (v: number) => void;
  weeklyLimit: number;
  setWeeklyLimit: (v: number) => void;
  dailySpendAlert: number;
  setDailySpendAlert: (v: number) => void;
  noSpendChallenge: { month: string; target: number } | null;
  setNoSpendChallenge: (v: { month: string; target: number } | null) => void;
  challenge52: { start: string; unit: number; done: number[] } | null;
  setChallenge52: (v: { start: string; unit: number; done: number[] } | null) => void;
  heightCm: number;
  setHeightCm: (v: number) => void;
  focusGoal: number;
  setFocusGoal: (v: number) => void;
  dhikrGoal: number;
  setDhikrGoal: (v: number) => void;
  lastBackupAt: string | null;
  setLastBackupAt: (v: string | null) => void;
  checklists: Record<string, string[]>;
  toggleChecklistItem: (key: string, item: string) => void;
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
      roundUpSince: null,
      setRoundUpSince: (v) => set({ roundUpSince: v }),
      hideBalances: false,
      setHideBalances: (v) => set({ hideBalances: v }),
      lowBalanceAlert: 0,
      setLowBalanceAlert: (v) => set({ lowBalanceAlert: v }),
      occasionReminders: false,
      setOccasionReminders: (v) => set({ occasionReminders: v }),
      monThuReminders: false,
      setMonThuReminders: (v) => set({ monThuReminders: v }),
      zakatHawl: null,
      setZakatHawl: (v) => set({ zakatHawl: v }),
      textScale: 1,
      setTextScale: (v) => set({ textScale: v }),
      quranReminder: null,
      setQuranReminder: (v) => set({ quranReminder: v }),
      readingGoal: 0,
      setReadingGoal: (v) => set({ readingGoal: v }),
      prayerAdjust: {},
      setPrayerAdjust: (v) => set({ prayerAdjust: v }),
      fridayChecklist: null,
      setFridayChecklist: (v) => set({ fridayChecklist: v }),
      recapDismissedMonth: null,
      setRecapDismissedMonth: (v) => set({ recapDismissedMonth: v }),
      favoriteDuas: [],
      toggleFavoriteDua: (id) =>
        set((s) => ({ favoriteDuas: s.favoriteDuas.includes(id) ? s.favoriteDuas.filter((d) => d !== id) : [...s.favoriteDuas, id] })),
      missedPromptDate: null,
      setMissedPromptDate: (v) => set({ missedPromptDate: v }),
      cardDueReminders: true,
      setCardDueReminders: (v) => set({ cardDueReminders: v }),
      spendDigest: false,
      setSpendDigest: (v) => set({ spendDigest: v }),
      use24h: false,
      setUse24h: (v) => set({ use24h: v }),
      wholeMoney: false,
      setWholeMoney: (v) => set({ wholeMoney: v }),
      recentSearches: [],
      addRecentSearch: (q) =>
        set((s) => {
          const t = q.trim();
          if (t.length < 2) return {};
          return { recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) };
        }),
      clearRecentSearches: () => set({ recentSearches: [] }),
      fitr: { people: 1, perPerson: 0 },
      setFitr: (v) => set({ fitr: v }),
      weekendDays: [5, 6],
      setWeekendDays: (v) => set({ weekendDays: v }),
      weekStart: 6,
      setWeekStart: (v) => set({ weekStart: v }),
      weeklyLimit: 0,
      setWeeklyLimit: (v) => set({ weeklyLimit: v }),
      dailySpendAlert: 0,
      setDailySpendAlert: (v) => set({ dailySpendAlert: v }),
      noSpendChallenge: null,
      setNoSpendChallenge: (v) => set({ noSpendChallenge: v }),
      challenge52: null,
      setChallenge52: (v) => set({ challenge52: v }),
      heightCm: 0,
      setHeightCm: (v) => set({ heightCm: v }),
      focusGoal: 0,
      setFocusGoal: (v) => set({ focusGoal: v }),
      dhikrGoal: 0,
      setDhikrGoal: (v) => set({ dhikrGoal: v }),
      lastBackupAt: null,
      setLastBackupAt: (v) => set({ lastBackupAt: v }),
      checklists: {},
      toggleChecklistItem: (key, item) =>
        set((s) => {
          const cur = s.checklists[key] ?? [];
          return { checklists: { ...s.checklists, [key]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] } };
        }),
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
