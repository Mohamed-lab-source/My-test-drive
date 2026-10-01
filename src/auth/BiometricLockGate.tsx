import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, type AppStateStatus } from 'react-native';
import { Icon } from '../ui/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { isBiometricLockEnabled, authenticate } from './biometricLock';
import { useSettingsStore } from '../store/settingsStore';

// Locks the app behind Face ID/fingerprint when enabled in Settings: locked
// on first mount and again when the app returns from the background after
// the chosen timeout (immediately by default).
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const leftAt = useRef<number | null>(null);
  // The system unlock prompt itself backgrounds the app on some phones;
  // ignore those transitions so it can't re-lock in a loop.
  const authenticating = useRef(false);

  const tryUnlock = async () => {
    authenticating.current = true;
    try {
      const ok = await authenticate();
      setLocked(!ok);
    } finally {
      authenticating.current = false;
    }
  };

  useEffect(() => {
    isBiometricLockEnabled().then(async (enabled) => {
      if (enabled) {
        setLocked(true);
        await tryUnlock();
      }
      setChecked(true);
    });

    const sub = AppState.addEventListener('change', (next) => {
      if (authenticating.current) {
        appState.current = next;
        return;
      }
      if (next.match(/inactive|background/) && leftAt.current === null) leftAt.current = Date.now();
      if (appState.current.match(/inactive|background/) && next === 'active') {
        const away = leftAt.current ? Date.now() - leftAt.current : 0;
        leftAt.current = null;
        const timeoutMs = useSettingsStore.getState().lockTimeoutMinutes * 60000;
        if (away >= timeoutMs) {
          isBiometricLockEnabled().then((enabled) => {
            if (enabled) {
              setLocked(true);
              tryUnlock();
            }
          });
        }
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!checked) return null;

  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock.fill" size={48} color={colors.secondaryLabel} />
        <Text style={[typography.title3, { color: colors.label, marginTop: spacing.md }]}>Anchor is locked</Text>
        <Pressable onPress={tryUnlock} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.body, { color: colors.blue, fontWeight: '600' }]}>Unlock</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
