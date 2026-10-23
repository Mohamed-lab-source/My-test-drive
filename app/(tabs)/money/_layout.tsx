import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function MoneyLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // The iOS push: slides in from the right with the old screen parallaxing away.
        animation: 'ios_from_right',
        fullScreenGestureEnabled: true,
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
      <Stack.Screen name="accounts" options={{ presentation: 'card' }} />
      <Stack.Screen name="zakat" options={{ presentation: 'card' }} />
      <Stack.Screen name="bills-calendar" options={{ presentation: 'card' }} />
      <Stack.Screen name="account/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="sms-inbox" options={{ presentation: 'card' }} />
      <Stack.Screen name="shopping" options={{ presentation: 'card' }} />
      <Stack.Screen name="tools" options={{ presentation: 'card' }} />
      <Stack.Screen name="year" options={{ presentation: 'card' }} />
      <Stack.Screen name="receipts" options={{ presentation: 'card' }} />
      <Stack.Screen name="uncategorized" options={{ presentation: 'card' }} />
      <Stack.Screen name="insights" options={{ presentation: 'card' }} />
      <Stack.Screen name="flagged" options={{ presentation: 'card' }} />
      <Stack.Screen name="challenges" options={{ presentation: 'card' }} />
      <Stack.Screen name="merchant" options={{ presentation: 'card' }} />
      <Stack.Screen name="cards" options={{ presentation: 'card' }} />
    </Stack>
  );
}
