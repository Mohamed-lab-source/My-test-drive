import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { tabStackListeners } from '../../../src/navigation/tabReturn';

const listeners = tabStackListeners('settings');

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenListeners={listeners} screenOptions={{ headerShown: false, animation: 'ios_from_right', fullScreenGestureEnabled: true, freezeOnBlur: true, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="section" />
      <Stack.Screen name="categories" />
    </Stack>
  );
}
