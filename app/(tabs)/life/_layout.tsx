import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function LifeLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.systemGroupedBackground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="wishlist" />
      <Stack.Screen name="habits" />
      <Stack.Screen name="journal" />
      <Stack.Screen name="tasbih" />
      <Stack.Screen name="quran" />
      <Stack.Screen name="fasting" />
      <Stack.Screen name="occasions" />
      <Stack.Screen name="prayer-times" />
      <Stack.Screen name="adhkar" />
      <Stack.Screen name="hijri-calendar" />
      <Stack.Screen name="health" />
      <Stack.Screen name="sunnah-prayers" />
      <Stack.Screen name="books" />
      <Stack.Screen name="countdowns" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="medications" />
    </Stack>
  );
}
