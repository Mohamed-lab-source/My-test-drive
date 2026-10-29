import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Share, Alert, TextInput, Platform, Pressable } from 'react-native';
import { Switch } from '../../ui/Switch';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore, type Accent, type Appearance } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { useProductivityStore } from '../../store/productivityStore';
import { useLifeStore } from '../../store/lifeStore';
import { useHabitsStore } from '../../store/habitsStore';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { NavHeader } from '../../ui/NavHeader';
import Animated from 'react-native-reanimated';
import { AmbientGlow } from '../../ui/AmbientGlow';
import { CompactHeader, useScrollY } from '../../ui/CollapsingHeader';
import { Appear } from '../../ui/Appear';
import { GradientCard } from '../../ui/GradientCard';
import { heroGradient } from '../../theme/shade';
import { Icon } from '../../ui/Icon';
import { Card } from '../../ui/Card';
import { ListRow } from '../../ui/ListRow';
import { IconCircle } from '../../ui/IconCircle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChipSelector } from '../../ui/ChipSelector';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import { exportAllData, importAllData, resetAllData } from '../../db/backup';
import { exportTasksCsv, exportTransactionsCsv } from '../../db/csvExport';
import { DataStatsCard } from '../../features/settings/DataStatsCard';
import {
  requestNotificationPermission,
  reschedulePrayerAlerts,
  rescheduleAllReminders,
  rescheduleOccasionReminders,
  sendTestNotification,
} from '../../notifications/scheduler';
import { clearHandledSmsText } from '../../db/repositories/smsImports';
import { rescheduleExtraReminders } from '../../notifications/extras';
import { setAsrMadhab as applyAsrMadhab, setPrayerAdjustments } from '../../utils/prayerTimes';
import { PRAYER_CITIES } from '../../utils/prayerTimes';
import { formatHijri } from '../../utils/hijri';
import { useAuth } from '../../auth/AuthProvider';
import { buildMonthlyReport } from '../../utils/monthlyReport';
import { fetchLiveRates } from '../../utils/liveRates';
import { palette } from '../../theme/colors';
import { MonthStartPicker } from '../../features/money/MonthStartPicker';

function FxRateRow({ currency, baseCurrency }: { currency: string; baseCurrency: string }) {
  const { colors, spacing } = useTheme();
  const existing = useFinanceStore((s) => s.fxRates.find((r) => r.currency === currency));
  const setFxRate = useFinanceStore((s) => s.setFxRate);
  const [value, setValue] = useState(existing ? String(existing.rate_to_base) : '');
  // Picks up rates fetched online.
  useEffect(() => {
    if (existing) setValue(String(Number(existing.rate_to_base.toPrecision(6))));
  }, [existing?.rate_to_base]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <Text style={{ color: colors.label, flex: 1 }}>
        1 {currency} = ? {baseCurrency}
      </Text>
      <TextField
        placeholder="rate"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        onBlur={() => {
          const n = Number(value);
          if (n > 0) setFxRate(currency, n);
        }}
        style={{ width: 100, height: 40 }}
      />
    </View>
  );
}

const APPEARANCE_OPTIONS: Appearance[] = ['system', 'light', 'dark'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'EGP', 'MAD', 'TRY', 'INR', 'PKR', 'MYR', 'IDR'];

import { searchSettings, SECTION_TITLES, type SettingsSection } from './settingsIndex';
export { SECTION_TITLES, type SettingsSection };

// One component for the main Settings list and each section page, so
// every setting keeps a single implementation.
export function SettingsScreen({ section }: { section?: SettingsSection }) {
  const { colors, typography, spacing, radius, scheme } = useTheme();
  const allSettings = useSettingsStore(
    useShallow((s) => ({
      hapticsEnabled: s.hapticsEnabled,
      monthFromPayday: s.monthFromPayday,
      monthStartDay: s.monthStartDay,
      prayerAlerts: s.prayerAlerts,
      prayerCityId: s.prayerCityId,
      use24h: s.use24h,
    }))
  );
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const router = useRouter();
  const { appearance, setAppearance, currency, setCurrency, notificationsEnabled, setNotificationsEnabled, defaultAccountId, setDefaultAccountId, prayerCityId, setPrayerCityId, prayerAlerts, setPrayerAlerts, hijriOffset, setHijriOffset, jumuahReminder, setJumuahReminder, sunnahFastReminders, setSunnahFastReminders, morningBriefing, setMorningBriefing, eveningJournal, setEveningJournal, waterReminders, setWaterReminders, smsImportEnabled, occasionReminders, setOccasionReminders, monThuReminders, setMonThuReminders, lowBalanceAlert, setLowBalanceAlert, prayerAdjust, setPrayerAdjust, textScale, setTextScale, use24h, setUse24h, wholeMoney, setWholeMoney, cardDueReminders, setCardDueReminders, spendDigest, setSpendDigest, dailySpendAlert, setDailySpendAlert, weekendDays, setWeekendDays, weekStart, setWeekStart, lastBackupAt, setLastBackupAt, accent, setAccent, displayName, setDisplayName, quietHours, setQuietHours, monthlyRecapReminder, setMonthlyRecapReminder, tahajjudReminder, setTahajjudReminder, weeklyReviewReminder, setWeeklyReviewReminder, hapticsEnabled, setHapticsEnabled, softDark, setSoftDark, startTab, setStartTab, asrMadhab, setAsrMadhab, adhanPrayers, setAdhanPrayers, prePrayerMinutes, setPrePrayerMinutes } = useSettingsStore(useShallow((s) => ({ appearance: s.appearance, setAppearance: s.setAppearance, currency: s.currency, setCurrency: s.setCurrency, notificationsEnabled: s.notificationsEnabled, setNotificationsEnabled: s.setNotificationsEnabled, defaultAccountId: s.defaultAccountId, setDefaultAccountId: s.setDefaultAccountId, prayerCityId: s.prayerCityId, setPrayerCityId: s.setPrayerCityId, prayerAlerts: s.prayerAlerts, setPrayerAlerts: s.setPrayerAlerts, hijriOffset: s.hijriOffset, setHijriOffset: s.setHijriOffset, jumuahReminder: s.jumuahReminder, setJumuahReminder: s.setJumuahReminder, sunnahFastReminders: s.sunnahFastReminders, setSunnahFastReminders: s.setSunnahFastReminders, morningBriefing: s.morningBriefing, setMorningBriefing: s.setMorningBriefing, eveningJournal: s.eveningJournal, setEveningJournal: s.setEveningJournal, waterReminders: s.waterReminders, setWaterReminders: s.setWaterReminders, smsImportEnabled: s.smsImportEnabled, occasionReminders: s.occasionReminders, setOccasionReminders: s.setOccasionReminders, monThuReminders: s.monThuReminders, setMonThuReminders: s.setMonThuReminders, lowBalanceAlert: s.lowBalanceAlert, setLowBalanceAlert: s.setLowBalanceAlert, prayerAdjust: s.prayerAdjust, setPrayerAdjust: s.setPrayerAdjust, textScale: s.textScale, setTextScale: s.setTextScale, use24h: s.use24h, setUse24h: s.setUse24h, wholeMoney: s.wholeMoney, setWholeMoney: s.setWholeMoney, cardDueReminders: s.cardDueReminders, setCardDueReminders: s.setCardDueReminders, spendDigest: s.spendDigest, setSpendDigest: s.setSpendDigest, dailySpendAlert: s.dailySpendAlert, setDailySpendAlert: s.setDailySpendAlert, weekendDays: s.weekendDays, setWeekendDays: s.setWeekendDays, weekStart: s.weekStart, setWeekStart: s.setWeekStart, lastBackupAt: s.lastBackupAt, setLastBackupAt: s.setLastBackupAt, accent: s.accent, setAccent: s.setAccent, displayName: s.displayName, setDisplayName: s.setDisplayName, quietHours: s.quietHours, setQuietHours: s.setQuietHours, monthlyRecapReminder: s.monthlyRecapReminder, setMonthlyRecapReminder: s.setMonthlyRecapReminder, tahajjudReminder: s.tahajjudReminder, setTahajjudReminder: s.setTahajjudReminder, weeklyReviewReminder: s.weeklyReviewReminder, setWeeklyReviewReminder: s.setWeeklyReviewReminder, hapticsEnabled: s.hapticsEnabled, setHapticsEnabled: s.setHapticsEnabled, softDark: s.softDark, setSoftDark: s.setSoftDark, startTab: s.startTab, setStartTab: s.setStartTab, asrMadhab: s.asrMadhab, setAsrMadhab: s.setAsrMadhab, adhanPrayers: s.adhanPrayers, setAdhanPrayers: s.setAdhanPrayers, prePrayerMinutes: s.prePrayerMinutes, setPrePrayerMinutes: s.setPrePrayerMinutes })));
  const [resetVisible, setResetVisible] = useState(false);
  const [resetText, setResetText] = useState('');
  const [nameInput, setNameInput] = useState(displayName);
  const [dailyAlertInput, setDailyAlertInput] = useState(dailySpendAlert > 0 ? String(dailySpendAlert / 100) : '');

  const adjustPrayer = async (prayer: string, delta: number) => {
    const next = { ...prayerAdjust, [prayer]: Math.max(-30, Math.min(30, (prayerAdjust[prayer] ?? 0) + delta)) };
    setPrayerAdjust(next);
    setPrayerAdjustments(next);
    await reschedulePrayerAlerts();
  };
  const [lowBalanceInput, setLowBalanceInput] = useState(lowBalanceAlert > 0 ? String(lowBalanceAlert / 100) : '');

  // Shared by the opt-in reminder toggles: ask for permission first, then
  // store the preference and re-arm everything that depends on it.
  const toggleWithPermission = async (value: boolean, apply: (v: boolean) => void) => {
    if (value && !notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications for Anchor in your device Settings first.');
        return;
      }
    }
    apply(value);
    await rescheduleExtraReminders();
  };

  const handleTogglePrayerAlerts = async (value: boolean) => {
    if (value && !notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications for Anchor in your device Settings to get adhan alerts.');
        return;
      }
    }
    setPrayerAlerts(value);
    await reschedulePrayerAlerts();
    await rescheduleOccasionReminders();
  };

  const handleToggleJumuah = async (value: boolean) => {
    if (value && !notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', "Enable notifications for Anchor in your device Settings to get Jumu'ah reminders.");
        return;
      }
    }
    setJumuahReminder(value);
    await reschedulePrayerAlerts();
  };
  const { user, signOut } = useAuth();
  const accounts = useFinanceStore((s) => s.accounts);
  const hydrateFinance = useFinanceStore((s) => s.hydrate);
  const hydrateProductivity = useProductivityStore((s) => s.hydrate);
  const hydrateLife = useLifeStore((s) => s.hydrate);
  const hydrateHabits = useHabitsStore((s) => s.hydrate);

  const fxRates = useFinanceStore((s) => s.fxRates);
  const recentTx = useFinanceStore((s) => s.transactions);
  // Any currency you hold, spend in (e.g. a USD subscription) or have a rate for.
  const foreignCurrencies = useMemo(
    () =>
      Array.from(new Set([...accounts.map((a) => a.currency), ...recentTx.map((t) => t.currency), ...fxRates.map((r) => r.currency)])).filter(
        (c) => c !== currency
      ),
    [accounts, recentTx, fxRates, currency]
  );
  const [ratesBusy, setRatesBusy] = useState(false);
  const updateRatesOnline = async () => {
    setRatesBusy(true);
    try {
      const { rates, updated } = await fetchLiveRates(currency, foreignCurrencies);
      const setFx = useFinanceStore.getState().setFxRate;
      for (const [c, r] of Object.entries(rates)) await setFx(c, r);
      Alert.alert('Rates updated', `${Object.keys(rates).length} rate${Object.keys(rates).length === 1 ? '' : 's'} updated${updated ? ` (published ${updated.replace(/ \+0000$/, ' UTC')})` : ''}.`);
    } catch (e) {
      Alert.alert('Could not update rates', 'Check your internet connection and try again. You can still type rates by hand.');
    } finally {
      setRatesBusy(false);
    }
  };

  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);


  const appearanceIndex = APPEARANCE_OPTIONS.indexOf(appearance);

  const handleExport = async () => {
    const json = await exportAllData();
    const result = await Share.share({ message: json, title: 'Anchor backup' });
    if (result.action !== Share.dismissedAction) setLastBackupAt(new Date().toISOString());
  };

  const backupDays = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;

  const handleExportCsv = async () => {
    const csv = await exportTransactionsCsv();
    await Share.share({ message: csv, title: 'Anchor transactions.csv' });
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      await importAllData(importText);
      await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]);
      setImportText('');
      setImportVisible(false);
      Alert.alert('Import complete', 'Your data has been restored.');
    } catch (e) {
      Alert.alert('Import failed', 'That did not look like a valid Anchor backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications for Anchor in your device Settings to get reminders.');
      }
    } else {
      setNotificationsEnabled(false);
    }
    await rescheduleAllReminders(
      useProductivityStore.getState().meetings,
      useFinanceStore.getState().recurringRules,
      useProductivityStore.getState().tasks,
      useFinanceStore.getState().debts
    );
    await reschedulePrayerAlerts();
    await rescheduleExtraReminders();
  };


  // Typing RESET guards against a stray tap wiping everything.
  const handleReset = () => {
    setResetText('');
    setResetVisible(true);
  };
  const confirmReset = async () => {
    setResetVisible(false);
    await resetAllData();
    await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]);
  };

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const searchResults = searchSettings(q).slice(0, 8);
  const cityName = PRAYER_CITIES.find((c) => c.id === allSettings.prayerCityId)?.name;
  const MENU: { id: SettingsSection; icon: string; color: string; summary: string }[] = [
    {
      id: 'general',
      icon: 'gearshape.fill',
      color: colors.gray,
      summary: `${appearance[0].toUpperCase()}${appearance.slice(1)} · ${allSettings.use24h ? '24-hour' : '12-hour'} clock${allSettings.hapticsEnabled === false ? ' · no vibration' : ''}`,
    },
    {
      id: 'money',
      icon: 'banknote.fill',
      color: colors.green,
      summary: `${currency} · month starts ${allSettings.monthFromPayday ? 'on payday' : `on the ${allSettings.monthStartDay}${allSettings.monthStartDay === 1 ? 'st' : allSettings.monthStartDay === 2 ? 'nd' : allSettings.monthStartDay === 3 ? 'rd' : 'th'}`} · categories`,
    },
    { id: 'prayer', icon: 'moon.stars.fill', color: colors.teal, summary: cityName ? `${cityName} · adhan ${allSettings.prayerAlerts ? 'on' : 'off'}` : 'Choose your city for prayer times' },
    { id: 'notifications', icon: 'bell.fill', color: colors.red, summary: 'Reminders, briefing, quiet hours, digests' },
    {
      id: 'data',
      icon: 'archivebox.fill',
      color: colors.blue,
      summary: backupDays === null ? 'No backup yet — export one' : `Last backup ${backupDays === 0 ? 'today' : `${backupDays} day${backupDays === 1 ? '' : 's'} ago`}`,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      {section ? <NavHeader title={SECTION_TITLES[section]} /> : <AmbientGlow colors={[colors.gray, colors.blue]} />}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: section ? spacing.sm : insets.top, paddingBottom: 140 }}
      >
        {section ? null : <ScreenHeader scrollY={scrollY} title="Settings" />}

        {!section ? (
        <Appear index={0} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}>
            <GradientCard colors={heroGradient(colors.blue)} style={{ width: 62, height: 62, borderRadius: 31, padding: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[typography.title2, { color: '#FFFFFF' }]}>
                {(user?.name || displayName || user?.email || 'A')
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </GradientCard>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.title3, { color: colors.label }]} numberOfLines={1}>
                {user?.name || displayName || 'Anchor account'}
              </Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]} numberOfLines={1}>
                {user?.email ? `${user.email} · ` : ''}Sync & backup
              </Text>
            </View>
          </Card>
        </Appear>
        ) : null}

        {!section ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <TextField placeholder="Search settings" value={query} onChangeText={setQuery} autoCorrect={false} />
            {query.trim() ? (
              <Card padded={false} style={{ marginTop: -spacing.xs }}>
                {searchResults.length ? (
                  searchResults.map((r, i) => (
                    <ListRow
                      key={r.label}
                      title={r.label}
                      subtitle={SECTION_TITLES[r.section]}
                      isLast={i === searchResults.length - 1}
                      showChevron
                      onPress={() => {
                        setQuery('');
                        router.push(r.section === 'money' && /categor/i.test(r.label) ? '/settings/categories' : `/settings/section?id=${r.section}`);
                      }}
                    />
                  ))
                ) : (
                  <ListRow title="No matching settings" isLast />
                )}
              </Card>
            ) : (
              <Card padded={false} style={{ marginTop: -spacing.xs }}>
                {MENU.map((m, i) => (
                  <ListRow
                    key={m.id}
                    title={SECTION_TITLES[m.id]}
                    subtitle={m.summary}
                    isLast={i === MENU.length - 1}
                    leading={<IconCircle filled name={m.icon} color={m.color} size={32} />}
                    onPress={() => router.push(`/settings/section?id=${m.id}`)}
                    showChevron
                  />
                ))}
              </Card>
            )}
          </View>
        ) : null}

        {!section ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Card padded={false}>
            <ListRow
              title="Achievements"
              subtitle="Milestones you've reached"
              leading={<IconCircle filled name="star.fill" color={colors.yellow} size={32} />}
              onPress={() => router.push('/achievements')}
              showChevron
            />
            <ListRow
              title="Today's recap"
              subtitle="Your day at a glance — also tap the rings on Home"
              leading={<IconCircle filled name="chart.bar.fill" color={colors.green} size={32} />}
              onPress={() => router.push('/recap')}
              showChevron
            />
            <ListRow
              title="Home-screen widgets"
              subtitle="Smart Stack, spending, tasks, habits, prayers — preview and add them"
              leading={<IconCircle filled name="square.grid.2x2" color={colors.indigo} size={32} />}
              onPress={() => router.push('/widgets')}
              showChevron
            />
            <ListRow
              title="What's in Anchor"
              subtitle="A quick tour of every feature and where to find it"
              isLast
              leading={<IconCircle filled name="sparkles" color={colors.purple} size={32} />}
              onPress={() => router.push('/whats-new')}
              showChevron
            />
          </Card>
        </View>
        ) : null}

        {!section ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Account
          </Text>
          <Card padded={false}>
            <ListRow title="Sign out" destructive isLast onPress={signOut} />
          </Card>
        </View>
        ) : null}

        {section === 'general' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Appearance
          </Text>
          <Card>
            <SegmentedControl
              options={['System', 'Light', 'Dark']}
              selectedIndex={appearanceIndex}
              onChange={(i) => setAppearance(APPEARANCE_OPTIONS[i])}
            />
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Text size
            </Text>
            <SegmentedControl
              options={['Default', 'Large', 'Larger', 'Largest']}
              selectedIndex={Math.max(0, [1, 1.15, 1.3, 1.45].indexOf(textScale))}
              onChange={(i) => setTextScale([1, 1.15, 1.3, 1.45][i])}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>24-hour clock</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Show times like 17:30</Text>
              </View>
              <Switch value={use24h} onValueChange={setUse24h} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Whole-number amounts</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Show EGP 1,250 instead of EGP 1,249.50</Text>
              </View>
              <Switch value={wholeMoney} onValueChange={setWholeMoney} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Soft dark mode</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Charcoal instead of pure black in dark mode</Text>
              </View>
              <Switch value={softDark} onValueChange={setSoftDark} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Vibration</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Haptic taps when you tick, count and save</Text>
              </View>
              <Switch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
            </View>
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>Open the app on</Text>
            <ChipSelector
              options={[
                { id: 'home', label: 'Home' },
                { id: 'money', label: 'Money' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'life', label: 'Life' },
              ]}
              selectedId={startTab}
              onSelect={(id) => setStartTab(id as typeof startTab)}
            />
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>Accent colour</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'green', 'teal'] as Accent[]).map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setAccent(a)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    marginRight: 10,
                    marginBottom: 8,
                    backgroundColor: palette[scheme][a],
                    borderWidth: accent === a ? 3 : 0,
                    borderColor: colors.label,
                  }}
                />
              ))}
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <TextField
                label="Your name (for the Home greeting)"
                placeholder="Optional"
                value={nameInput}
                onChangeText={setNameInput}
                onBlur={() => setDisplayName(nameInput.trim())}
              />
            </View>
          </Card>
        </View>
        ) : null}

        {section === 'money' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Currency
          </Text>
          <Card>
            <ChipSelector
              options={CURRENCIES.map((c) => ({ id: c, label: c }))}
              selectedId={currency}
              onSelect={setCurrency}
            />
          </Card>
        </View>
        ) : null}

        {section === 'prayer' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Prayer times & Hijri date
          </Text>
          <Card>
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>City</Text>
            <ChipSelector
              options={PRAYER_CITIES.map((c) => ({ id: c.id, label: c.name }))}
              selectedId={prayerCityId}
              onSelect={(id) => {
                setPrayerCityId(id);
                reschedulePrayerAlerts();
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Adhan alerts</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>A notification at each prayer time</Text>
              </View>
              <Switch value={prayerAlerts} disabled={!prayerCityId} onValueChange={handleTogglePrayerAlerts} />
            </View>
            {prayerAlerts && prayerCityId ? (
              <>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm, marginBottom: 6 }]}>Alert me for</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => {
                    const on = (adhanPrayers ?? []).includes(p);
                    return (
                      <Pressable
                        key={p}
                        onPress={async () => {
                          setAdhanPrayers(on ? adhanPrayers.filter((x) => x !== p) : [...adhanPrayers, p]);
                          await reschedulePrayerAlerts();
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 14,
                          marginRight: 6,
                          marginBottom: 6,
                          backgroundColor: on ? colors.blue : colors.tertiaryFill,
                        }}
                      >
                        <Text style={[typography.subhead, { color: on ? '#fff' : colors.label, textTransform: 'capitalize' }]}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm, marginBottom: 6 }]}>
                  Get-ready reminder before each of those
                </Text>
                <ChipSelector
                  options={[0, 10, 15, 20, 30].map((m) => ({ id: String(m), label: m ? `${m} min` : 'Off' }))}
                  selectedId={String(prePrayerMinutes)}
                  onSelect={async (id) => {
                    setPrePrayerMinutes(Number(id));
                    await reschedulePrayerAlerts();
                  }}
                />
              </>
            ) : null}
            {prayerCityId ? (
              <>
                <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>Asr time</Text>
                <ChipSelector
                  options={[
                    { id: 'auto', label: 'City default' },
                    { id: 'shafi', label: "Shafi'i / Maliki / Hanbali" },
                    { id: 'hanafi', label: 'Hanafi (later)' },
                  ]}
                  selectedId={asrMadhab}
                  onSelect={async (id) => {
                    setAsrMadhab(id as typeof asrMadhab);
                    applyAsrMadhab(id as typeof asrMadhab);
                    await reschedulePrayerAlerts();
                  }}
                />
              </>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Jumu'ah reminder</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Fridays, an hour before Dhuhr</Text>
              </View>
              <Switch value={jumuahReminder} disabled={!prayerCityId} onValueChange={handleToggleJumuah} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Sunnah fast reminders</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  Evening before the white days, Arafah and Ashura
                </Text>
              </View>
              <Switch value={sunnahFastReminders} onValueChange={(v) => toggleWithPermission(v, setSunnahFastReminders)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Monday & Thursday fasts</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>A reminder on Sunday and Wednesday evenings</Text>
              </View>
              <Switch value={monThuReminders} onValueChange={(v) => toggleWithPermission(v, setMonThuReminders)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.label }]}>Islamic occasions</Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  Ramadan, the last ten nights, both Eids and the new year
                </Text>
              </View>
              <Switch value={occasionReminders} onValueChange={(v) => toggleWithPermission(v, setOccasionReminders)} />
            </View>
            {prayerCityId ? (
              <>
                <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                  Fine-tune times to match your mosque (minutes)
                </Text>
                {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => (
                  <View key={p} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                    <Text style={[typography.body, { color: colors.label, flex: 1, textTransform: 'capitalize' }]}>{p}</Text>
                    <Pressable onPress={() => adjustPrayer(p, -1)} hitSlop={8}>
                      <Icon name="minus.circle" size={24} color={colors.blue} />
                    </Pressable>
                    <Text style={[typography.body, { color: colors.label, width: 48, textAlign: 'center' }]}>
                      {(prayerAdjust[p] ?? 0) > 0 ? '+' : ''}
                      {prayerAdjust[p] ?? 0}
                    </Text>
                    <Pressable onPress={() => adjustPrayer(p, 1)} hitSlop={8}>
                      <Icon name="plus.circle.fill" size={24} color={colors.blue} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Hijri date adjustment · {formatHijri(new Date(), hijriOffset)}
            </Text>
            <ChipSelector
              options={[-2, -1, 0, 1, 2].map((n) => ({ id: String(n), label: n > 0 ? `+${n}` : String(n) }))}
              selectedId={String(hijriOffset)}
              onSelect={(id) => setHijriOffset(Number(id))}
            />
          </Card>
        </View>
        ) : null}

        {section === 'money' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Default account for new transactions
          </Text>
          <Card>
            <ChipSelector
              options={accounts.filter((a) => !a.is_archived).map((a) => ({ id: a.id, label: a.name, color: a.color, icon: a.icon }))}
              selectedId={defaultAccountId}
              onSelect={(id) => setDefaultAccountId(id === defaultAccountId ? null : id)}
            />
            <View style={{ marginTop: spacing.md }}>
              <TextField
                label={`Low-balance alert (${currency})`}
                placeholder="Off — e.g. 1000"
                keyboardType="decimal-pad"
                value={lowBalanceInput}
                onChangeText={setLowBalanceInput}
                onBlur={() => setLowBalanceAlert(Math.round((Number(lowBalanceInput) || 0) * 100))}
              />
              <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: -spacing.sm }]}>
                Get a notification when an account drops below this after a transaction.
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <TextField
                  label={`Daily spending limit (${currency})`}
                  placeholder="From your plan — e.g. 500"
                  keyboardType="decimal-pad"
                  value={dailyAlertInput}
                  onChangeText={setDailyAlertInput}
                  onBlur={() => setDailySpendAlert(Math.round((Number(dailyAlertInput) || 0) * 100))}
                />
                <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: -spacing.sm }]}>
                  Blank uses your spending plan. Alerts at 80% and 100% — set weekly and monthly limits in Money → Plan.
                </Text>
              </View>
              <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>Weekend</Text>
              <ChipSelector
                options={[
                  { id: '5,6', label: 'Fri – Sat' },
                  { id: '6,0', label: 'Sat – Sun' },
                  { id: '5', label: 'Friday only' },
                ]}
                selectedId={weekendDays.join(',')}
                onSelect={(id) => setWeekendDays(id.split(',').map(Number))}
              />
              <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: spacing.xs }]}>Week starts on</Text>
              <ChipSelector
                options={[
                  { id: '6', label: 'Saturday' },
                  { id: '0', label: 'Sunday' },
                  { id: '1', label: 'Monday' },
                ]}
                selectedId={String(weekStart)}
                onSelect={(id) => setWeekStart(Number(id))}
              />
              <View style={{ marginTop: spacing.md }}>
                <MonthStartPicker />
              </View>
            </View>
          </Card>
        </View>
        ) : null}

        {section === 'money' && foreignCurrencies.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
              Exchange rates
            </Text>
            <Card>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                Set a manual rate so accounts in other currencies count toward net worth.
              </Text>
              {foreignCurrencies.map((c) => (
                <FxRateRow key={c} currency={c} baseCurrency={currency} />
              ))}
              <Pressable onPress={updateRatesOnline} disabled={ratesBusy} style={{ marginTop: spacing.xs }}>
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>
                  {ratesBusy ? 'Updating…' : '↻ Update rates online'}
                </Text>
              </Pressable>
            </Card>
          </View>
        ) : null}

        {section === 'notifications' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Notifications & Security
          </Text>
          <Card padded={false}>
            <ListRow
              title="Reminders"
              subtitle="Meeting and bill-due notifications"
              leading={<IconCircle filled name="bell.fill" color={colors.red} size={32} />}
              trailing={<Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />}
            />
            <ListRow
              title="Send a test notification"
              subtitle="Check that alerts reach you"
              leading={<IconCircle filled name="bell.fill" color={colors.orange} size={32} />}
              onPress={async () => {
                if (!(await sendTestNotification())) Alert.alert('Notifications are off', 'Turn on Reminders above and allow notifications for Anchor.');
              }}
            />
            <ListRow
              title="Upcoming reminders"
              subtitle="Everything Anchor has scheduled"
              leading={<IconCircle filled name="clock.fill" color={colors.blue} size={32} />}
              onPress={() => router.push('/reminders')}
              showChevron
            />
            <ListRow
              title="Morning briefing"
              subtitle="8 AM: today's tasks, meetings and bills"
              leading={<IconCircle filled name="sun.max.fill" color={colors.orange} size={32} />}
              trailing={<Switch value={morningBriefing} onValueChange={(v) => toggleWithPermission(v, setMorningBriefing)} />}
            />
            <ListRow
              title="Card payment due"
              subtitle="3 days before and on each credit card's due day"
              leading={<IconCircle filled name="creditcard.fill" color={colors.purple} size={32} />}
              trailing={<Switch value={cardDueReminders} onValueChange={(v) => toggleWithPermission(v, setCardDueReminders)} />}
            />
            <ListRow
              title="Monthly recap"
              subtitle="10 AM on the 1st: last month in review"
              leading={<IconCircle filled name="calendar" color={colors.indigo} size={32} />}
              trailing={<Switch value={monthlyRecapReminder} onValueChange={(v) => toggleWithPermission(v, setMonthlyRecapReminder)} />}
            />
            <ListRow
              title="Weekly review"
              subtitle="8 PM on the last day of your week"
              leading={<IconCircle filled name="chart.bar.fill" color={colors.purple} size={32} />}
              trailing={<Switch value={weeklyReviewReminder} onValueChange={(v) => toggleWithPermission(v, setWeeklyReviewReminder)} />}
            />
            <ListRow
              title="Tahajjud"
              subtitle="At the last third of the night (needs your city)"
              leading={<IconCircle filled name="moon.stars.fill" color={colors.indigo} size={32} />}
              trailing={<Switch value={tahajjudReminder} onValueChange={(v) => toggleWithPermission(v, setTahajjudReminder)} />}
            />
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={[typography.body, { color: colors.label }]}>Quiet hours</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: 6 }]}>
                Spending and budget alerts that happen at night wait until morning
              </Text>
              <ChipSelector
                options={[
                  { id: 'off', label: 'Off' },
                  { id: '22-7', label: '10 PM – 7 AM' },
                  { id: '23-7', label: '11 PM – 7 AM' },
                  { id: '0-8', label: '12 AM – 8 AM' },
                ]}
                selectedId={quietHours ? `${quietHours.from}-${quietHours.to}` : 'off'}
                onSelect={(id) => {
                  if (id === 'off') return setQuietHours(null);
                  const [from, to] = id.split('-').map(Number);
                  setQuietHours({ from, to });
                }}
              />
            </View>
            <ListRow
              title="Nightly spending digest"
              subtitle="9:30 PM: what you spent today, and how much on credit"
              leading={<IconCircle filled name="chart.bar.fill" color={colors.teal} size={32} />}
              trailing={<Switch value={spendDigest} onValueChange={(v) => toggleWithPermission(v, setSpendDigest)} />}
            />
            <ListRow
              title="Water reminders"
              subtitle="Every 2 hours, 9 AM – 9 PM"
              leading={<IconCircle filled name="drop.fill" color={colors.cyan} size={32} />}
              trailing={<Switch value={waterReminders} onValueChange={(v) => toggleWithPermission(v, setWaterReminders)} />}
            />
            {Platform.OS === 'android' ? (
              <ListRow
                title="Bank SMS"
                subtitle={smsImportEnabled ? 'On — debits wait for review in Money' : 'Read debit alerts (e.g. HSBC) from SMS'}
                leading={<IconCircle filled name="banknote.fill" color={colors.green} size={32} />}
                onPress={() => router.push('/money/sms-inbox')}
                showChevron
              />
            ) : null}
            <ListRow
              title="Evening check-in"
              subtitle="9 PM: log your mood and gratitude"
              isLast
              leading={<IconCircle filled name="text.book.closed.fill" color={colors.indigo} size={32} />}
              trailing={<Switch value={eveningJournal} onValueChange={(v) => toggleWithPermission(v, setEveningJournal)} />}
            />
          </Card>
        </View>
        ) : null}

        {section === 'money' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Manage
          </Text>
          <Card padded={false}>
            <ListRow
              title="Categories"
              leading={<IconCircle filled name="chart.pie.fill" color={colors.blue} size={32} />}
              showChevron
              onPress={() => router.push('/settings/categories')}
            />
          </Card>
        </View>
        ) : null}

        {section === 'data' ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Data
          </Text>
          <DataStatsCard />
          <Card padded={false}>
            <ListRow
              title="Export backup"
              subtitle={
                backupDays === null
                  ? 'Never backed up — export one and keep it somewhere safe'
                  : backupDays === 0
                    ? 'Last backup today'
                    : `Last backup ${backupDays} day${backupDays === 1 ? '' : 's'} ago${backupDays > 30 ? ' — time for a new one' : ''}`
              }
              leading={<IconCircle filled name="square.and.arrow.up" color={backupDays === null || backupDays > 30 ? colors.orange : colors.green} size={32} />}
              onPress={handleExport}
            />
            <ListRow
              title="Share monthly report"
              subtitle="Money, tasks, prayers, habits and mood this month"
              leading={<IconCircle filled name="chart.bar.fill" color={colors.indigo} size={32} />}
              onPress={async () => Share.share({ message: await buildMonthlyReport() })}
            />
            <ListRow
              title="Export transactions (CSV)"
              leading={<IconCircle filled name="doc.text.fill" color={colors.teal} size={32} />}
              onPress={handleExportCsv}
            />
            <ListRow
              title="Export tasks (CSV)"
              leading={<IconCircle filled name="checklist" color={colors.blue} size={32} />}
              onPress={async () => Share.share({ message: await exportTasksCsv(), title: 'Anchor tasks.csv' })}
            />
            <ListRow
              title="Restore from backup"
              leading={<IconCircle filled name="square.and.arrow.down" color={colors.orange} size={32} />}
              onPress={() => setImportVisible(true)}
            />
            {Platform.OS === 'android' ? (
              <ListRow
                title="Clear bank SMS text"
                subtitle="Erase the stored text of messages you've already handled"
                leading={<IconCircle filled name="banknote.fill" color={colors.gray} size={32} />}
                onPress={() =>
                  Alert.alert('Clear SMS text?', 'Messages waiting for review are kept. Handled ones keep their amount and merchant but lose the original text.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        const n = await clearHandledSmsText();
                        Alert.alert('Done', `Cleared ${n} message${n === 1 ? '' : 's'}.`);
                      },
                    },
                  ])
                }
              />
            ) : null}
            <ListRow
              title="Reset all data"
              destructive
              isLast
              leading={<IconCircle filled name="trash.fill" color={colors.red} size={32} />}
              onPress={handleReset}
            />
          </Card>
        </View>
        ) : null}

        {!section ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center' }]}>
            Anchor {Constants.expoConfig?.version ?? ''} · everything stays on this device
          </Text>
        </View>
        ) : null}
      </Animated.ScrollView>
      {section ? null : <CompactHeader title="Settings" scrollY={scrollY} />}

      <Sheet visible={resetVisible} onClose={() => setResetVisible(false)}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.title2, { color: colors.red, marginBottom: spacing.sm }]}>Reset all data</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
            This permanently deletes everything in the app and can't be undone. Export a backup first. Type RESET to confirm.
          </Text>
          <TextField placeholder="RESET" value={resetText} onChangeText={setResetText} autoCapitalize="characters" autoCorrect={false} />
          <Button title="Delete everything" variant="destructive" onPress={confirmReset} disabled={resetText.trim() !== 'RESET'} />
        </View>
      </Sheet>

      <Sheet visible={importVisible} onClose={() => setImportVisible(false)}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Restore backup</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            Paste the JSON you previously exported.
          </Text>
          <TextInput
            multiline
            value={importText}
            onChangeText={setImportText}
            placeholder="{ ...backup json... }"
            placeholderTextColor={colors.placeholderText}
            style={{
              minHeight: 160,
              backgroundColor: colors.tertiarySystemGroupedBackground,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: colors.label,
              marginBottom: spacing.md,
              textAlignVertical: 'top',
            }}
          />
          <Button title="Restore" onPress={handleImport} disabled={!importText.trim()} loading={busy} />
        </View>
      </Sheet>
    </View>
  );
}
