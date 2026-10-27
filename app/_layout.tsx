import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, AppState, Platform } from 'react-native';
import { refreshWidgets } from '../src/widgets/refresh';
import { WIDGET_NAMES } from '../src/widgets/renderers';
import { seedPreviewData } from '../src/dev/previewSeed';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { DESTINATIONS } from '../src/navigation/destinations';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useFinanceStore } from '../src/store/financeStore';
import { useProductivityStore } from '../src/store/productivityStore';
import { useLifeStore } from '../src/store/lifeStore';
import { useHabitsStore } from '../src/store/habitsStore';
import { AuthProvider, useAuth, type AuthStatus } from '../src/auth/AuthProvider';
import { pullAllFromCloud } from '../src/sync/firestoreSync';
import { UndoSnackbar } from '../src/ui/UndoSnackbar';
import {
  initNotifications,
  reschedulePrayerAlerts,
  rescheduleAllReminders,
  rescheduleOccasionReminders,
} from '../src/notifications/scheduler';
import { rescheduleExtraReminders, rescheduleMorningAllowance } from '../src/notifications/extras';
import { applyAutoRoutines } from '../src/utils/autoRoutines';

import { useSmsStore, syncSmsAlertConfig } from '../src/sms/smsStore';
import { setAsrMadhab, setPrayerAdjustments } from '../src/utils/prayerTimes';
import { setUse24hClock } from '../src/utils/date';
import { setWholeMoney } from '../src/utils/money';
import { settingsHydrated, useSettingsStore } from '../src/store/settingsStore';

// Display preferences live in plain module flags so the formatters stay pure;
// keep them in step with Settings (including after storage rehydrates).
const applyDisplayPrefs = (s: { use24h: boolean; wholeMoney: boolean }) => {
  setUse24hClock(s.use24h);
  setWholeMoney(s.wholeMoney);
};
applyDisplayPrefs(useSettingsStore.getState());
useSettingsStore.subscribe(applyDisplayPrefs);

function useProtectedRoute(status: AuthStatus) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status !== 'signedIn' && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, segments]);
}

// Opens the screen a tapped notification points at (content.data.url).
function useNotificationLinks(ready: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      // Ignore a stale "last response" from long ago on a cold start.
      if (!r || Date.now() - r.notification.date > 10 * 60000) return;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready]);
}

function AppShell() {
  const { colors, scheme } = useTheme();
  const { status, user } = useAuth();
  const [dataReady, setDataReady] = useState(false);

  const hydrateFinance = useFinanceStore((s) => s.hydrate);
  const hydrateProductivity = useProductivityStore((s) => s.hydrate);
  const hydrateLife = useLifeStore((s) => s.hydrate);
  const hydrateHabits = useHabitsStore((s) => s.hydrate);

  useProtectedRoute(status);
  useNotificationLinks(status === 'signedIn' && dataReady);

  // Remember screens as they're opened, for "Jump back in" on Home.
  const pathname = usePathname();
  useEffect(() => {
    if (DESTINATIONS[pathname]) useSettingsStore.getState().addRecentScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    initNotifications();
    // The web build is a design preview: give it sample data to show.
    (Platform.OS === 'web' ? seedPreviewData().catch(() => {}) : Promise.resolve())
      .then(() => Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]))
      .then(async () => {
        setDataReady(true);
        await settingsHydrated();
        setPrayerAdjustments(useSettingsStore.getState().prayerAdjust);
        setAsrMadhab(useSettingsStore.getState().asrMadhab);
        // Bank SMS: pick up any new debit alerts (no-op unless turned on).
        syncSmsAlertConfig();
        useSmsStore
          .getState()
          .scan()
          .catch((e) => console.warn('Bank SMS scan failed', e));
        // Local notifications don't exist on web.
        if (Platform.OS === 'web') return;
        await rescheduleAllReminders(
          useProductivityStore.getState().meetings,
          useFinanceStore.getState().recurringRules,
          useProductivityStore.getState().tasks,
          useFinanceStore.getState().debts
        );
        await reschedulePrayerAlerts();
        await rescheduleOccasionReminders();
        await rescheduleExtraReminders();
        await applyAutoRoutines().catch(() => 0);
      })
      .catch((e) => {
        console.error('Failed to hydrate app state', e);
        setDataReady(true);
      });
  }, []);

  // Re-check bank SMS each time the app comes back to the foreground, so a
  // card payment made a minute ago is waiting when you open Anchor.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useSmsStore.getState().scan().catch(() => {});
        // A new day may have started while Anchor was in the background.
        applyAutoRoutines().catch(() => 0);
        if (Platform.OS !== 'web') rescheduleMorningAllowance().catch(() => {});
      } else if (state === 'background' && Platform.OS === 'android') {
        // Leaving the app: bring every home-screen widget up to date.
        refreshWidgets(WIDGET_NAMES);
      }
    });
    return () => sub.remove();
  }, []);

  // Once signed in, pull any data synced from other devices down into local
  // SQLite, then re-hydrate the stores so the UI reflects the merged data.
  useEffect(() => {
    if (status !== 'signedIn' || !user) return;
    pullAllFromCloud()
      .then(() => Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]))
      .catch((e) => console.error('Cloud sync failed', e));
  }, [status, user?.uid]);

  if (status === 'loading' || !dataReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.systemGroupedBackground }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  const content = (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right', fullScreenGestureEnabled: true, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="review" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="whats-new" />
        <Stack.Screen name="widgets" />
        <Stack.Screen name="recap" />
        <Stack.Screen name="achievements" />
      </Stack>
      <UndoSnackbar />
    </>
  );

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {content}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
