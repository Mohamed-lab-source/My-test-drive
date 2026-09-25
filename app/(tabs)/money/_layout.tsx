import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function MoneyLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.systemGroupedBackground },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="debts" options={{ presentation: 'card' }} />
      <Stack.Screen name="subscriptions" options={{ presentation: 'card' }} />
      <Stack.Screen name="savings" options={{ presentation: 'card' }} />
      <Stack.Screen name="transactions" options={{ presentation: 'card' }} />
      <Stack.Screen name="budgets" options={{ presentation: 'card' }} />
      <Stack.Screen name="analytics" options={{ presentation: 'card' }} />
    </Stack>
  );
}
