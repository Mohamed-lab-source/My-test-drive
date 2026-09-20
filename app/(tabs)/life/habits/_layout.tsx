import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export default function HabitsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="identities" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="scorecard" />
    </Stack>
  );
}
