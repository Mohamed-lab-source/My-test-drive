import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function TasksLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="meetings" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="agenda" />
    </Stack>
  );
}
