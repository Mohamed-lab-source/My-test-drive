import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useFinanceStore } from '../src/store/financeStore';
import { useProductivityStore } from '../src/store/productivityStore';
import { useLifeStore } from '../src/store/lifeStore';
import { useHabitsStore } from '../src/store/habitsStore';
import { AuthProvider, useAuth, type AuthStatus } from '../src/auth/AuthProvider';
import { pullAllFromCloud } from '../src/sync/firestoreSync';
import { UndoSnackbar } from '../src/ui/UndoSnackbar';
import { initNotifications } from '../src/notifications/scheduler';
import { BiometricLockGate } from '../src/auth/BiometricLockGate';

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

function AppShell() {
  const { colors, scheme } = useTheme();
  const { status, user } = useAuth();
  const [dataReady, setDataReady] = useState(false);

  const hydrateFinance = useFinanceStore((s) => s.hydrate);
  const hydrateProductivity = useProductivityStore((s) => s.hydrate);
  const hydrateLife = useLifeStore((s) => s.hydrate);
  const hydrateHabits = useHabitsStore((s) => s.hydrate);

  useProtectedRoute(status);

  useEffect(() => {
    initNotifications();
    Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()])
      .then(() => setDataReady(true))
      .catch((e) => {
        console.error('Failed to hydrate app state', e);
        setDataReady(true);
      });
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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      </Stack>
      <UndoSnackbar />
    </>
  );

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {status === 'signedIn' ? <BiometricLockGate>{content}</BiometricLockGate> : content}
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
